import os, sqlite3
from pathlib import Path
import pandas as pd
import streamlit as st
from telemetry.db import connect

DB_PATH = Path(os.environ.get("CLAUDE_TELEMETRY_DB", "~/.claude/telemetry/telemetry.db")).expanduser()
connect(DB_PATH).close()

st.set_page_config(page_title="Claude Token Telemetry", page_icon="📡", layout="wide")
st.title("Claude Token Telemetry")
st.caption("Local telemetry for Claude Code: exact request usage plus estimated tool/file/skill attribution. "
           "Filter by project or client in the sidebar. With no filter, shows global (all projects) view.")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

def q(sql, params=()):
    return pd.read_sql_query(sql, conn, params=params)

def fmt_num(n):
    """Format number with K/M/B suffix."""
    if pd.isna(n) or n == 0:
        return "0"
    if abs(n) >= 1_000_000_000:
        return f"{n / 1_000_000_000:.1f}B"
    if abs(n) >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if abs(n) >= 1_000:
        return f"{n / 1_000:.1f}K"
    return f"{int(n):,}"

def fmt_cost(n):
    """Format cost — always show full precision since costs are small USD."""
    if pd.isna(n) or n == 0:
        return "$0.00"
    return f"${n:.4f}"

usage = q("SELECT * FROM usage")
tools = q("SELECT * FROM tool_calls")
skills = q("SELECT * FROM skill_events")
events = q("SELECT * FROM events")

projects = ["All"] + sorted(
    set(usage.get("project", pd.Series(dtype=str)).dropna().tolist()) |
    set(events.get("project", pd.Series(dtype=str)).dropna().tolist())
)
clients = ["All"] + sorted(
    set(usage.get("client", pd.Series(dtype=str)).dropna().tolist()) |
    set(events.get("client", pd.Series(dtype=str)).dropna().tolist())
)

st.sidebar.header("Filters")
project = st.sidebar.selectbox("Project", projects)
client = st.sidebar.selectbox("Client / IDE", clients)

# --- Global summary (unfiltered) ---
st.sidebar.header("Global totals")
if not usage.empty:
    gtotal = int(usage.total_tokens.sum())
    gcost = usage.cost_usd.sum()
    greqs = len(usage)
    gproj = usage.project.nunique() if "project" in usage.columns else 0
    gclients = usage.client.nunique() if "client" in usage.columns else 0
    gmodels = usage.model.nunique() if "model" in usage.columns else 0
    c1, c2, c3, c4 = st.sidebar.columns(4)
    c1.metric("Tokens", fmt_num(gtotal))
    c2.metric("Cost", fmt_cost(gcost))
    c3.metric("Requests", fmt_num(greqs))
    c4.metric("Projects", str(gproj))

    if not events.empty:
        g_events = len(events)
        st.sidebar.metric("Hook events", fmt_num(g_events))
else:
    st.sidebar.info("No data yet")

def filt(df):
    if df.empty:
        return df
    out = df
    if project != "All" and "project" in out.columns:
        out = out[out.project == project]
    if client != "All" and "client" in out.columns:
        out = out[out.client == client]
    return out

u, t, s, e = map(filt, [usage, tools, skills, events])

# Metric cards
vals = [
    int(u[c].sum()) if not u.empty and c in u.columns else 0
    for c in ["total_tokens", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"]
]
for col, label, val in zip(
    st.columns(5),
    ["Exact API tokens", "Input", "Output", "Cache read", "Cache write"],
    vals
):
    col.metric(label, fmt_num(val))

# Cost + model breakdown row
if not u.empty:
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Total cost", fmt_cost(u.cost_usd.sum()))
    col2.metric("Requests", fmt_num(len(u)))
    if "model" in u.columns:
        top_model = u.model.value_counts().index[0] if not u.model.isna().all() else "n/a"
        col3.metric("Top model", top_model)
    if "client" in u.columns:
        top_client = u.client.value_counts().index[0] if not u.client.isna().all() else "n/a"
        col4.metric("Top client", top_client)
    col5.metric("Avg tokens/req", fmt_num(int(u.total_tokens.mean())) if "total_tokens" in u.columns else "n/a")

    # Cost over time (last 30 days)
    if "event_time" in u.columns:
        ut = u[["event_time", "cost_usd"]].dropna(subset=["event_time"]).copy()
        ut["event_time"] = pd.to_datetime(ut["event_time"], errors="coerce")
        ut = ut.dropna(subset=["event_time"])
        if not ut.empty:
            ut = ut.set_index("event_time").resample("D")["cost_usd"].sum().reset_index()
            st.subheader("Daily cost")
            st.line_chart(ut.set_index("event_time")["cost_usd"])

tabs = st.tabs(["Overview", "Hotspots", "Tools", "Skills", "Sessions", "Timeline", "Raw events"])

with tabs[0]:
    st.subheader("Usage by project")
    if not u.empty:
        x = u.groupby("project", as_index=False).agg(
            total_tokens=("total_tokens", "sum"),
            cost_usd=("cost_usd", "sum"),
            requests=("id", "count")
        ).sort_values("total_tokens", ascending=False)
        disp = x.copy()
        disp["total_tokens"] = disp["total_tokens"].apply(fmt_num)
        disp["cost_usd"] = disp["cost_usd"].apply(fmt_cost)
        st.dataframe(disp, use_container_width=True, hide_index=True)
        st.bar_chart(x.set_index("project")["total_tokens"])
    else:
        st.info("No reconciled usage yet. Run `python -m telemetry.reconcile` or start the daemon.")

with tabs[1]:
    st.subheader("Estimated token attribution")
    st.caption("Exact API usage is not file-level. These allocations divide each matched request across nearby tools, then across paths, so attributed totals do not exceed the matched request usage.")
    try:
        attrib = q("""
            SELECT project, category,
                   ROUND(SUM(estimated_tokens), 1) AS estimated_tokens,
                   COUNT(*) AS reference_count
            FROM attributions
            GROUP BY project, category
            ORDER BY estimated_tokens DESC
        """)
        attrib = filt(attrib)
    except pd.io.sql.DatabaseError:
        attrib = pd.DataFrame()

    if not attrib.empty:
        disp = attrib.copy()
        disp["estimated_tokens"] = disp["estimated_tokens"].apply(fmt_num)
        st.dataframe(disp, use_container_width=True, hide_index=True)
        cat = (attrib.groupby("category", as_index=False)["estimated_tokens"].sum()
               .sort_values("estimated_tokens", ascending=False).head(20))
        st.bar_chart(cat.set_index("category")["estimated_tokens"])
    else:
        st.info("No estimated file/path attribution available yet.")

    try:
        paths = q("""
            SELECT project, path, category,
                   ROUND(SUM(estimated_tokens), 1) AS estimated_tokens,
                   COUNT(*) AS reference_count
            FROM attributions
            GROUP BY project, path, category
            ORDER BY estimated_tokens DESC
        """)
        paths = filt(paths)
    except pd.io.sql.DatabaseError:
        paths = pd.DataFrame()
    if not paths.empty:
        st.subheader("Top files / paths")
        disp = paths.copy()
        disp["estimated_tokens"] = disp["estimated_tokens"].apply(fmt_num)
        st.dataframe(disp.head(200), use_container_width=True, hide_index=True)

with tabs[2]:
    st.subheader("Tool activity")
    if not t.empty:
        x = (t.groupby(["tool_name"], as_index=False).size()
             .rename(columns={"size": "calls"})
             .sort_values("calls", ascending=False))
        disp = x.copy()
        disp["calls"] = disp["calls"].apply(fmt_num)
        st.dataframe(disp, use_container_width=True, hide_index=True)
        st.bar_chart(x.set_index("tool_name")["calls"])
    else:
        st.info("No tool calls recorded.")

with tabs[3]:
    st.subheader("Skill telemetry")
    if not s.empty:
        x = (s.groupby(["skill_name", "trigger_type"], dropna=False, as_index=False).size()
             .rename(columns={"size": "calls"})
             .sort_values("calls", ascending=False))
        disp = x.copy()
        disp["calls"] = disp["calls"].apply(fmt_num)
        st.dataframe(disp, use_container_width=True, hide_index=True)
        st.bar_chart(x.groupby("skill_name")["calls"].sum())
        st.subheader("Recent skill activations")
        st.dataframe(s.sort_values("id", ascending=False).head(200),
                     use_container_width=True, hide_index=True)
    else:
        st.info("No Skill activations recorded yet.")

with tabs[4]:
    st.subheader("Sessions")
    if not u.empty:
        sess = (u.groupby(["session_id", "project", "client", "model"], dropna=False, as_index=False)
                .agg(total_tokens=("total_tokens", "sum"),
                     input_tokens=("input_tokens", "sum"),
                     output_tokens=("output_tokens", "sum"),
                     cache_read_tokens=("cache_read_tokens", "sum"),
                     cache_write_tokens=("cache_write_tokens", "sum"),
                     cost_usd=("cost_usd", "sum"),
                     interactions=("id", "count"))
                .sort_values("total_tokens", ascending=False))
        disp = sess.copy()
        for c in ["total_tokens", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"]:
            disp[c] = disp[c].apply(fmt_num)
        disp["cost_usd"] = disp["cost_usd"].apply(fmt_cost)
        disp["interactions"] = disp["interactions"].apply(fmt_num)
        st.dataframe(disp, use_container_width=True, hide_index=True)

with tabs[5]:
    st.subheader("Telemetry timeline")
    parts = []
    if not e.empty:
        ee = e[["event_time", "session_id", "project", "event_type", "tool_name", "skill_name"]].copy()
        ee["detail"] = ee["tool_name"].fillna(ee["skill_name"]).fillna("")
        parts.append(ee[["event_time", "session_id", "project", "event_type", "detail"]])
    if not u.empty:
        uu = u[["event_time", "session_id", "project", "total_tokens"]].copy()
        uu["event_type"] = "api_usage"
        uu["detail"] = uu["total_tokens"].apply(lambda x: f"{fmt_num(x)} tokens")
        parts.append(uu[["event_time", "session_id", "project", "event_type", "detail"]])
    if parts:
        timeline = pd.concat(parts, ignore_index=True).sort_values("event_time", ascending=False)
        st.dataframe(timeline.head(1000), use_container_width=True, hide_index=True)

with tabs[6]:
    st.subheader("Raw hook events")
    if not e.empty:
        st.dataframe(e.sort_values("id", ascending=False).head(1000),
                     use_container_width=True, hide_index=True)
    else:
        st.info("No live hook events recorded yet.")

st.divider()
st.caption(f"Database: {DB_PATH}")
conn.close()