import json, time, websocket, urllib.request

_id = 0
def cmd(ws, m, p=None, t=15):
    global _id
    _id += 1
    ws.send(json.dumps({"id": _id, "method": m, "params": p or {}}))
    end = time.time() + t
    while time.time() < end:
        ws.settimeout(max(0.5, end - time.time()))
        try:
            r = json.loads(ws.recv())
            if r.get("id") == _id:
                return r
        except Exception:
            break
    return None

def ev(ws, expr, t=15):
    r = cmd(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, t)
    return (r or {}).get("result", {}).get("result", {}).get("value")

def rect_at(ws, sel_text):
    return ev(ws, """
    (function(){
      var els = document.querySelectorAll('div[role="button"], div[role="radio"], button, input');
      for (var e of els) {
        if ((e.textContent||'').includes(%s) || (e.getAttribute('aria-label')||'').includes(%s)) {
          var r = e.getBoundingClientRect();
          return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2, found: true});
        }
      }
      return JSON.stringify({found: false});
    })()
    """ % (json.dumps(sel_text), json.dumps(sel_text)))

def mouse(ws, x, y):
    cmd(ws, "Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cmd(ws, "Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})

def screen_text(ws):
    return ev(ws, "document.body.innerText.substring(0, 1500)") or ""

def click_text(ws, text, wait=1.5):
    pos = rect_at(ws, text)
    try:
        p = json.loads(pos)
    except Exception:
        return "PARSE_FAIL"
    if not p.get("found"):
        return "NOT_FOUND"
    mouse(ws, p["x"], p["y"])
    time.sleep(wait)
    return "CLICKED"

def type_into(ws, needle, value):
    return ev(ws, """
    (function(){
      var inputs = document.querySelectorAll('input');
      for (var i of inputs) {
        var ph = i.getAttribute('placeholder') || '';
        if (ph.includes(%s)) {
          i.focus();
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(i, %s);
          i.dispatchEvent(new Event('input', { bubbles: true }));
          return 'TYPED';
        }
      }
      return 'INPUT_NF';
    })()
    """ % (json.dumps(needle), json.dumps(value)))

resp = urllib.request.urlopen("http://localhost:9222/json")
targets = json.loads(resp.read())
page = next((t for t in targets if t.get("type") == "page"), None)
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30)
cmd(ws, "Page.enable")
cmd(ws, "Runtime.enable")

log = []
def out(s):
    log.append(str(s))
    print(s, flush=True)

cmd(ws, "Page.navigate", {"url": "http://localhost:8081/"})
time.sleep(12)

out("=== HOME ==="); out(screen_text(ws)[:250].replace("\n", " | "))
out("nav signup: " + click_text(ws, "Jisajili"))
out("pick patient: " + click_text(ws, "Mgonjwa"))
out("name: " + str(type_into(ws, "Jina kamili", "Asha Mwinyi")))
out("age: " + str(type_into(ws, "mf. 34", "34")))
out("phone: " + str(type_into(ws, "0712", "0712345678")))
out("pw: " + str(type_into(ws, "Nenosiri", "test1234")))
out("confirm: " + str(type_into(ws, "tena", "test1234")))
out("pick Mme: " + click_text(ws, "Mme"))

out("=== FORM BEFORE SUBMIT ==="); out(screen_text(ws)[:700].replace("\n", " | "))

pos = ev(ws, """
(function(){
  var els = document.querySelectorAll('div[role="button"]');
  var last = null;
  for (var e of els) { if ((e.textContent||'').includes('Jisajili')) last = e; }
  if (!last) return JSON.stringify({found:false});
  var r = last.getBoundingClientRect();
  return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2, found:true});
})()
""")
try:
    p = json.loads(pos)
except Exception:
    p = {"found": False}
if p.get("found"):
    mouse(ws, p["x"], p["y"])
    time.sleep(4)
    out("submit: CLICKED")
else:
    out("submit: NOT_FOUND")

out("=== AFTER SUBMIT ==="); out(screen_text(ws)[:700].replace("\n", " | "))
ws.close()
open("/tmp/e2e_reg.log", "w").write("\n".join(log))
print("WROTE_LOG")
