import json, time, websocket, urllib.request
_id = 0
def cmd(ws, m, p=None, t=20):
    global _id
    _id += 1
    ws.send(json.dumps({"id": _id, "method": m, "params": p or {}}))
    end = time.time() + t
    while time.time() < end:
        ws.settimeout(max(0.5, end - time.time()))
        try:
            r = json.loads(ws.recv())
            if r.get("id") == _id: return r
        except Exception: break
    return None
def ev(ws, expr, t=20):
    r = cmd(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True}, t)
    return (r or {}).get("result", {}).get("result", {}).get("value")
def mouse(ws, x, y):
    cmd(ws, "Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cmd(ws, "Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
def click_text(ws, text, wait=2):
    pos = ev(ws, """
    (function(){
      var els = document.querySelectorAll('div[role="button"], div[role="radio"]');
      for (var e of els) {
        if ((e.textContent||'').includes(%s)) {
          var r = e.getBoundingClientRect();
          return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2, found: true});
        }
      }
      return JSON.stringify({found: false});
    })()""" % json.dumps(text))
    try: p = json.loads(pos)
    except Exception: return "PARSE_FAIL: " + repr(pos)[:100]
    if not p.get("found"): return "NOT_FOUND"
    mouse(ws, p["x"], p["y"])
    time.sleep(wait)
    return "CLICKED"
def type_into(ws, needle, value):
    return ev(ws, """
    (function(){
      var inputs = document.querySelectorAll('input');
      for (var i of inputs) {
        var ph = (i.getAttribute('placeholder')||'');
        if (ph.toLowerCase().includes(%s.toLowerCase())) {
          i.focus();
          var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
          s.call(i, %s);
          i.dispatchEvent(new Event('input', {bubbles:true}));
          return 'TYPED:' + i.value;
        }
      }
      return 'INPUT_NF';
    })()""" % (json.dumps(needle), json.dumps(value)))
def screen(ws):
    return ev(ws, "document.body.innerText.substring(0,900)") or ""

resp = urllib.request.urlopen("http://localhost:9222/json")
page = next((t for t in json.loads(resp.read()) if t.get("type") == "page"), None)
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=40)
cmd(ws, "Page.enable"); cmd(ws, "Runtime.enable")
cmd(ws, "Page.navigate", {"url": "http://localhost:8081/"})
time.sleep(8)

log = []
def out(s): log.append(str(s)); print(s, flush=True)

out("home: " + click_text(ws, "Jisajili"))
out("role patient: " + click_text(ws, "Mgonjwa"))
out("name: " + str(type_into(ws, "jina lako kamili", "Asha Mwinyi")))
out("age: " + str(type_into(ws, "mf. 34", "34")))
out("phone: " + str(type_into(ws, "0712", "0712345678")))
out("pw: " + str(type_into(ws, "Tengeneza", "test1234")))
out("confirm: " + str(type_into(ws, "tena", "test1234")))
out("sex: " + click_text(ws, "Mme"))

# submit: last role=button containing Jisajili (form button comes after header pill)
btns = ev(ws, """
(function(){
  var res = [];
  var els = document.querySelectorAll('div[role="button"]');
  for (var e of els) {
    var t = e.textContent || '';
    if (t.includes('Jisajili')) {
      var r = e.getBoundingClientRect();
      res.push({x: r.x + r.width/2, y: r.y + r.height/2, txt: t.trim().substring(0,30)});
    }
  }
  return JSON.stringify(res);
})()
""")
try: arr = json.loads(btns)
except Exception: arr = []
out("submit candidates: " + json.dumps(arr))
if arr:
    target = arr[-1]
    mouse(ws, target["x"], target["y"])
    time.sleep(4)
    out("submit: CLICKED at " + json.dumps(target))
else:
    out("submit: NO_CANDIDATES")

out("=== AFTER SUBMIT ===")
out(screen(ws).replace("\n", " | "))
ws.close()
open("/tmp/e2e_reg2_result.log", "w").write("\n".join(log))
print("WROTE_LOG", flush=True)
