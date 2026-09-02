def rebuild_attributions(conn):
    conn.execute("DELETE FROM attributions")
    usages = conn.execute(
        """SELECT id,session_id,transcript_path,transcript_line,total_tokens
           FROM usage WHERE total_tokens > 0"""
    ).fetchall()

    for usage_id, session_id, transcript_path, line, total in usages:
        # Match tool calls in the same turn first, then a small neighborhood.
        tools = conn.execute(
            """SELECT tc.id
               FROM tool_calls tc
               WHERE tc.session_id=? AND tc.transcript_path=?
                 AND ABS(tc.transcript_line-?)<=5
               ORDER BY ABS(tc.transcript_line-?), tc.transcript_line, tc.id""",
            (session_id, transcript_path, line, line)
        ).fetchall()
        tool_ids = [r[0] for r in tools]
        if not tool_ids:
            continue

        # Get usage row for project
        usage_row = conn.execute("SELECT project FROM usage WHERE id=?", (usage_id,)).fetchone()
        proj = usage_row[0] if usage_row else None

        # One request can contain several tool calls. Split request tokens across
        # matched tools, then split each tool allocation across its paths.
        tool_share = float(total) / len(tool_ids)
        for tool_id in tool_ids:
            paths = conn.execute(
                "SELECT path,category FROM tool_paths WHERE tool_call_id=? ORDER BY id",
                (tool_id,)
            ).fetchall()
            if not paths:
                conn.execute(
                    """INSERT INTO attributions(
                        usage_id,tool_call_id,path,category,project,estimated_tokens,allocation_weight,method
                    ) VALUES(?,?,?,?,?,?,?,?)""",
                    (usage_id, tool_id, "[unattributed]", "[unattributed]", proj,
                     tool_share, tool_share / float(total), "nearest_tool_weighted")
                )
                continue
            path_share = tool_share / len(paths)
            for path, category in paths:
                conn.execute(
                    """INSERT INTO attributions(
                        usage_id,tool_call_id,path,category,project,estimated_tokens,allocation_weight,method
                    ) VALUES(?,?,?,?,?,?,?,?)""",
                    (usage_id, tool_id, path, category, proj, path_share,
                     path_share / float(total), "nearest_tool_weighted")
                )
    conn.commit()
