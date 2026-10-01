"""Verify the scroll-reveal pattern: hook, Reveal wrapper, CSS, and page wiring.

Checks:
1. src/hooks/useScrollReveal.ts exists with IntersectionObserver + reveal-once
   semantics + prefers-reduced-motion handling, and no duplicate hook elsewhere.
2. src/components/marketing/Reveal.tsx wraps children with .scroll-reveal and
   suppresses stagger delays under reduced motion.
3. index.css defines .scroll-reveal / .is-visible with opacity+transform only
   (no layout-shifting display/visibility) and a reduced-motion override.
4. Landing/marketing pages: every <Reveal> is balanced, per-card reveals use
   delayMs={i * 90}, the landing hero (id="home") is NOT wrapped, and the
   legacy animate-card-in entry animation is gone from these pages.
"""
import pathlib
import re
import sys

WEB = pathlib.Path(__file__).resolve().parent.parent
SRC = WEB / 'src'

PASS = []
FAIL = []


def check(name, cond, detail=''):
    (PASS if cond else FAIL).append('%s %s' % (name, detail))


# 1. Hook
hook = SRC / 'hooks' / 'useScrollReveal.ts'
check('hook:exists', hook.is_file())
if hook.is_file():
    t = hook.read_text()
    check('hook:observer', 'new IntersectionObserver' in t)
    check('hook:reveal-once', 'observer.disconnect()' in t)
    check('hook:reduced-motion', "(prefers-reduced-motion: reduce)" in t)
    check('hook:defaults', '0.15' in t and '0px 0px -60px 0px' in t)
# no duplicate scroll-reveal hook anywhere else
dupes = [str(p) for p in SRC.rglob('*.ts*') if 'ScrollReveal' in p.name and p.name != 'useScrollReveal.ts']
check('hook:no-duplicate', not dupes, str(dupes))

# 2. Reveal wrapper
reveal = SRC / 'components' / 'marketing' / 'Reveal.tsx'
check('reveal:exists', reveal.is_file())
if reveal.is_file():
    t = reveal.read_text()
    check('reveal:uses-hook', 'useScrollReveal' in t)
    check('reveal:uses-css-class', 'scroll-reveal' in t and 'is-visible' in t)
    check('reveal:delay-suppressed', 'usePrefersReducedMotion' in t)

# 3. CSS
css = (SRC / 'index.css').read_text()
check('css:base', re.search(r'\.scroll-reveal\s*\{[^}]*opacity:\s*0', css) is not None)
check('css:visible', re.search(r'\.scroll-reveal\.is-visible\s*\{[^}]*opacity:\s*1', css) is not None)
check('css:translate-only', 'translateY(24px)' in css and 'display' not in css.split('.scroll-reveal')[1].split('}')[0])
rm_ok = False
for chunk in css.split('@media (prefers-reduced-motion: reduce)')[1:]:
    chunk = chunk.split('@media')[0]  # stop at the next media query
    if '.scroll-reveal' in chunk and 'transition: none' in chunk and 'opacity: 1' in chunk:
        rm_ok = True
        break
check('css:reduced-motion', rm_ok)

# 4. Page wiring
PAGES = [
    SRC / 'pages' / 'LandingPage.tsx',
    SRC / 'pages' / 'marketing' / 'ServicesPage.tsx',
    SRC / 'pages' / 'marketing' / 'SpecialistsPage.tsx',
    SRC / 'pages' / 'marketing' / 'AboutPage.tsx',
]
for p in PAGES:
    t = p.read_text()
    name = p.name
    opens = len(re.findall(r'<Reveal\b', t))
    closes = t.count('</Reveal>')
    check('%s:balanced' % name, opens > 0 and opens == closes, '%d/%d' % (opens, closes))
    check('%s:no-legacy-anim' % name, 'animate-card-in' not in t)
    check('%s:import' % name, "marketing/Reveal'" in t)
    if name == 'LandingPage.tsx':
        # hero must NOT be wrapped: no Reveal between id="home" and its close
        hero = t.split('id="home"')[1].split('</section>')[0]
        check('%s:hero-unwrapped' % name, '<Reveal' not in hero)
    stagger = len(re.findall(r'delayMs=\{i \* 90\}', t))
    check('%s:stagger' % name, stagger > 0, '%d cards' % stagger)
    # balanced section/Reveal nesting sanity: no <Reveal directly inside <Reveal open line
    lines = t.split('\n')
    depth_ok = True
    stack = []
    for ln in lines:
        for tag in re.findall(r'</?Reveal\b', ln):
            if tag == '<Reveal':
                if stack:
                    depth_ok = False
                stack.append(tag)
            else:
                if stack:
                    stack.pop()
    check('%s:no-nested-reveals' % name, depth_ok and not stack)

print('PASS: %d' % len(PASS))
for p in PASS:
    print('  ✓', p)
if FAIL:
    print('FAIL: %d' % len(FAIL))
    for f in FAIL:
        print('  ✗', f)
sys.exit(1 if FAIL else 0)
