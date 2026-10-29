// DM Screen – tesztlefedettség mérése a Chrome DevTools-protokollal (a teszt.ps1 -Lefedettseg használja).
// C# 5 (a Windows PowerShell 5.1 Add-Type fordítója), külső csomag nélkül.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

public class Cdp {
  readonly ClientWebSocket ws = new ClientWebSocket();
  readonly JavaScriptSerializer js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 1000 };
  int nextId = 1;
  public readonly Dictionary<string, Dictionary<string, object>> Scripts = new Dictionary<string, Dictionary<string, object>>();

  public Cdp(string url) { ws.ConnectAsync(new Uri(url), CancellationToken.None).Wait(); }

  string Recv() {
    var ms = new MemoryStream(); var buf = new byte[1 << 16];
    while (true) {
      var r = ws.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None).Result;
      ms.Write(buf, 0, r.Count);
      if (r.EndOfMessage) break;
    }
    return Encoding.UTF8.GetString(ms.ToArray());
  }

  public Dictionary<string, object> Call(string method, string paramsJson) {
    int id = nextId++;
    var bytes = Encoding.UTF8.GetBytes("{\"id\":" + id + ",\"method\":\"" + method + "\",\"params\":" + (paramsJson ?? "{}") + "}");
    ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait();
    while (true) {
      var m = js.Deserialize<Dictionary<string, object>>(Recv());
      if (m.ContainsKey("method")) {
        if ((string)m["method"] == "Debugger.scriptParsed") { var p = (Dictionary<string, object>)m["params"]; Scripts[(string)p["scriptId"]] = p; }
        continue;
      }
      if (m.ContainsKey("id") && Convert.ToInt32(m["id"]) == id) {
        if (m.ContainsKey("error")) throw new Exception(method + ": " + js.Serialize(m["error"]));
        return (Dictionary<string, object>)m["result"];
      }
    }
  }

  public string Eval(string expr) {
    var r = (Dictionary<string, object>)Call("Runtime.evaluate", js.Serialize(new Dictionary<string, object> { { "expression", expr }, { "returnByValue", true } }))["result"];
    return r.ContainsKey("value") && r["value"] != null ? r["value"].ToString() : "";
  }
}

public class FileCov {
  public string Name, Text;
  public int[] Cnt;                                    // karakterenkénti futásszám; -1 = nem szkript (pl. HTML)
  public SortedDictionary<int, string> Funcs = new SortedDictionary<int, string>();  // kezdőpozíció → függvénynév
  public int Exec, Full, Partial, Chars, CharsHit, FuncsHit;
}

public static class Coverage {
  // \r\n → \n; map[i] = az eredeti i. karakter helye a normalizált szövegben
  static string Norm(string s, out int[] map) {
    var sb = new StringBuilder(s.Length); map = new int[s.Length + 1];
    for (int i = 0; i < s.Length; i++) { map[i] = sb.Length; if (s[i] == '\r' && i + 1 < s.Length && s[i + 1] == '\n') continue; sb.Append(s[i]); }
    map[s.Length] = sb.Length;
    return sb.ToString();
  }

  static int OffsetOf(string text, int line, int col) {
    int off = 0;
    for (int l = 0; l < line; l++) { off = text.IndexOf('\n', off); if (off < 0) return -1; off++; }
    return off + col;
  }

  public static List<FileCov> Build(string root, string[] files, Cdp cdp, Dictionary<string, object> taken) {
    var result = new Dictionary<string, FileCov>();
    foreach (var f in files) {
      int[] dummy;
      var t = Norm(File.ReadAllText(Path.Combine(root, f), Encoding.UTF8), out dummy);
      var fc = new FileCov { Name = f, Text = t, Cnt = new int[t.Length] };
      for (int i = 0; i < t.Length; i++) fc.Cnt[i] = -1;
      result[f] = fc;
    }
    foreach (Dictionary<string, object> sc in (ArrayList)taken["result"]) {
      var url = (string)sc["url"];
      if (!url.StartsWith("http")) continue;
      var path = Uri.UnescapeDataString(new Uri(url).AbsolutePath.TrimStart('/'));
      FileCov fc;
      if (!result.TryGetValue(path, out fc)) continue;
      var id = (string)sc["scriptId"];
      Dictionary<string, object> parsed;
      if (!cdp.Scripts.TryGetValue(id, out parsed)) continue;
      var src = (string)cdp.Call("Debugger.getScriptSource", "{\"scriptId\":\"" + id + "\"}")["scriptSource"];
      int[] map; var nsrc = Norm(src, out map);
      int off = OffsetOf(fc.Text, Convert.ToInt32(parsed["startLine"]), Convert.ToInt32(parsed["startColumn"]));
      if (off < 0 || off + nsrc.Length > fc.Text.Length || fc.Text.Substring(off, nsrc.Length) != nsrc) continue;  // pl. inline eseménykezelő

      // a tartományok egymásba ágyazódnak: kezdet szerint növekvő, hossz szerint csökkenő sorrendben a belső felülírja a külsőt
      var ranges = new List<int[]>();
      foreach (Dictionary<string, object> fn in (ArrayList)sc["functions"]) {
        bool first = true;
        foreach (Dictionary<string, object> r in (ArrayList)fn["ranges"]) {
          int s = Convert.ToInt32(r["startOffset"]), e = Convert.ToInt32(r["endOffset"]), c = Convert.ToInt32(r["count"]);
          ranges.Add(new[] { s, e, c });
          if (first && !(s == 0 && e >= src.Length)) {
            var name = (string)fn["functionName"];
            fc.Funcs[off + map[Math.Min(s, src.Length)]] = string.IsNullOrEmpty(name) ? "(névtelen)" : name;
          }
          first = false;
        }
      }
      var cnt = new int[src.Length];
      foreach (var r in ranges.OrderBy(r => r[0]).ThenByDescending(r => r[1]))
        for (int i = r[0]; i < Math.Min(r[1], src.Length); i++) cnt[i] = r[2];
      for (int i = 0; i < src.Length; i++) {
        if (map[i] == map[i + 1]) continue;  // elhagyott \r
        int j = off + map[i];
        fc.Cnt[j] = Math.Max(fc.Cnt[j] < 0 ? 0 : fc.Cnt[j], cnt[i]);
      }
    }
    foreach (var fc in result.Values) Stats(fc);
    return result.Values.ToList();
  }

  static bool OnlyPunct(string s) { foreach (var ch in s) if ("{}()[];,".IndexOf(ch) < 0 && !char.IsWhiteSpace(ch)) return false; return true; }

  // sorállapot: 0 = nem futtatható, 1 = lefutott, 2 = részben, 3 = nem futott le
  static int LineState(FileCov fc, int a, int b) {
    if (OnlyPunct(fc.Text.Substring(a, b - a))) return 0;
    int hit = 0, miss = 0;
    for (int i = a; i < b; i++) {
      if (char.IsWhiteSpace(fc.Text[i]) || fc.Cnt[i] < 0) continue;
      if (fc.Cnt[i] > 0) hit++; else miss++;
    }
    if (hit + miss == 0) return 0;
    return miss == 0 ? 1 : hit == 0 ? 3 : 2;
  }

  static void Stats(FileCov fc) {
    int a = 0;
    while (a <= fc.Text.Length) {
      int b = fc.Text.IndexOf('\n', a); if (b < 0) b = fc.Text.Length;
      int st = LineState(fc, a, b);
      if (st != 0) { fc.Exec++; if (st == 1) fc.Full++; else if (st == 2) fc.Partial++; }
      a = b + 1;
    }
    for (int i = 0; i < fc.Text.Length; i++) if (fc.Cnt[i] >= 0 && !char.IsWhiteSpace(fc.Text[i])) { fc.Chars++; if (fc.Cnt[i] > 0) fc.CharsHit++; }
    foreach (var k in fc.Funcs.Keys) if (fc.Cnt[k] > 0) fc.FuncsHit++;
  }

  static int LineOf(string t, int pos) { int n = 1; for (int i = 0; i < pos; i++) if (t[i] == '\n') n++; return n; }

  public static string Missed(List<FileCov> list) {
    var sb = new StringBuilder();
    foreach (var fc in list) {
      var miss = fc.Funcs.Where(kv => fc.Cnt[kv.Key] <= 0).ToList();
      sb.AppendLine("== " + fc.Name + " – le nem futott függvények: " + miss.Count);
      foreach (var kv in miss) sb.AppendLine("  " + LineOf(fc.Text, kv.Key) + "\t" + kv.Value);
    }
    return sb.ToString();
  }

  public static void Html(List<FileCov> list, string outPath) {
    var sb = new StringBuilder();
    sb.Append("<!doctype html><meta charset=utf-8><title>DM Screen – lefedettség</title><style>body{font:13px Consolas,monospace;background:#121418;color:#ccc;margin:16px}"
      + "h2{color:#e2a63b;font-family:Segoe UI,sans-serif}pre{margin:0}.l{display:block;white-space:pre-wrap}.n{color:#666;display:inline-block;width:50px;text-align:right;margin-right:8px;user-select:none}"
      + ".s0{color:#777}.s2{background:#4a3d12}.s3{background:#5a1a1a}</style>");
    sb.Append("<h1 style='font-family:Segoe UI'>Lefedettség</h1><p>piros = nem futott le, sárga = részben futott le</p>");
    foreach (var fc in list) sb.Append("<a href='#" + fc.Name + "'>" + fc.Name + "</a> ");
    foreach (var fc in list) {
      sb.Append("<h2 id='" + fc.Name + "'>" + fc.Name + "</h2><pre>");
      int a = 0, n = 1;
      while (a <= fc.Text.Length) {
        int b = fc.Text.IndexOf('\n', a); if (b < 0) b = fc.Text.Length;
        sb.Append("<span class='l s" + LineState(fc, a, b) + "'><span class=n>" + n + "</span>" + System.Net.WebUtility.HtmlEncode(fc.Text.Substring(a, b - a)) + "</span>");
        a = b + 1; n++;
      }
      sb.Append("</pre>");
    }
    File.WriteAllText(outPath, sb.ToString(), Encoding.UTF8);
  }
}
