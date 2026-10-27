"""
End-to-end test of the online accounts (same login on several devices,
two-way sync, password / login-ID recovery by mobile OTP, a device-only
account going online), against a local stand-in for the Supabase project:
e2e/backend/server.mjs runs an embedded PostgreSQL with the real migration and
answers like PostgREST and the `otp` edge function (SMS provider "test").

Usage:
  (cd e2e/backend && npm install)
  python3 e2e/cloud_test.py     # builds dist-cloud, starts the backend and a preview server
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import Page, expect, sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out-cloud')
API = 'http://localhost:54321'
BASE = 'http://localhost:4174/'
PW = re.compile(r'^पासवर्ड( \*)?$')
PW2 = re.compile(r'^पासवर्ड पुन्हा( \*)?$')

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def check(name: str, cond: bool, detail: str = ''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail else ''), flush=True)
    if not cond:
        raise AssertionError(name)


def sql(q: str) -> list[dict]:
    req = urllib.request.Request(f'{API}/__test/sql', data=json.dumps({'sql': q}).encode(), headers={'content-type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read())['rows']


def last_otp(phone: str) -> str | None:
    return json.loads(urllib.request.urlopen(f'{API}/__test/otp?phone={phone}').read())['code']


def up(url: str) -> bool:
    try:
        return urllib.request.urlopen(url, timeout=2).status == 200
    except Exception:
        return False


def wait_until(fn, timeout=20.0, step=0.25):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(step)
    return fn()


def go(pg: Page, path: str):
    pg.goto(BASE + '#' + path)


def login(pg: Page, user: str, password: str, expect_ok=True):
    pg.wait_for_selector('#login-user', timeout=20000)
    pg.locator('#login-user').fill(user)
    pg.locator('#login-pass').fill(password)
    pg.get_by_role('button', name='लॉगिन करा').click()
    if expect_ok:
        pg.wait_for_selector('main#main', timeout=30000)


def logout(pg: Page):
    if pg.locator('aside').is_visible():
        pg.locator('aside').get_by_role('button', name='बाहेर पडा').click()
    else:
        pg.get_by_role('button', name='मेनू उघडा').click()
        pg.get_by_role('dialog', name='मेनू').get_by_role('button', name='बाहेर पडा').click()
    pg.locator('dialog[open]').get_by_role('button', name='बाहेर पडा').click()
    pg.wait_for_selector('#login-user', timeout=20000)


def register(pg: Page, std_word: str, section: str, name: str, user: str, password: str, phone: str):
    pg.wait_for_selector('#login-user', timeout=20000)
    pg.get_by_role('button', name='नवीन खाते तयार करा').click()
    pg.get_by_role('radio', name=f'इयत्ता {std_word}').click()
    pg.get_by_label('तुकडी').select_option(section)
    pg.get_by_label(re.compile('^वर्गशिक्षकाचे नाव')).fill(name)
    if pg.get_by_label('शाळेचे नाव').count():
        pg.get_by_label('शाळेचे नाव').fill('जिल्हा परिषद प्राथमिक शाळा नमुनागाव')
    pg.get_by_label(re.compile('^वापरकर्ता नाव')).fill(user)
    pg.get_by_label(PW).fill(password)
    pg.get_by_label(PW2).fill(password)
    pg.get_by_label(re.compile('^मोबाईल नंबर')).fill(phone)
    pg.get_by_role('button', name='खाते तयार करा').click()
    pg.wait_for_selector('main#main', timeout=30000)


def badge(pg: Page):
    return pg.locator('header button', has=pg.locator('svg')).filter(has_text=re.compile('जतन|ऑनलाइन|लॉगिन|ऑफलाइन'))


def synced(pg: Page, timeout=30000):
    expect(pg.locator('header').get_by_text('ऑनलाइन जतन ✓')).to_be_visible(timeout=timeout)


def device(p, name: str, mobile=False):
    profile = tempfile.mkdtemp(prefix=f'cce-cloud-{name}-')
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900}
    ctx = p.chromium.launch_persistent_context(profile, viewport=vp, accept_downloads=True, locale='mr-IN')
    pg = ctx.pages[0]

    def on_console(m):
        if m.type == 'error' and 'Failed to load resource' not in m.text and 'net::ERR' not in m.text:
            console_errors.append(f'{name}: {m.text}')

    pg.on('console', on_console)
    pg.on('pageerror', lambda e: console_errors.append(f'{name} pageerror: {e}'))
    return ctx, pg, profile


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True)
    env = {**os.environ, 'VITE_CLOUD_URL': API}
    subprocess.run(['npx', 'vite', 'build', '--outDir', 'dist-cloud', '--emptyOutDir'], cwd=ROOT, env=env, check=True, capture_output=True)
    backend = subprocess.Popen(['node', os.path.join(HERE, 'backend', 'server.mjs'), '54321'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    line = backend.stdout.readline()
    if 'ready' not in line:
        print(line, backend.stdout.read())
        raise SystemExit('backend did not start')
    preview = subprocess.Popen(['npx', 'vite', 'preview', '--outDir', 'dist-cloud', '--port', '4174', '--strictPort'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    profiles = []
    try:
        if not wait_until(lambda: up(BASE), 30):
            raise SystemExit('preview server did not start')
        with sync_playwright() as p:
            # ---------------- device A: register online, add data ----------------
            ca, a, prof = device(p, 'A')
            profiles.append(prof)
            a.goto(BASE)
            register(a, 'सहावी', 'ब', 'सौ. नमुना शिक्षिका', 'cloud6', 'pass6666', '9876500001')
            acct = sql("select id::text, phone, standard, section from private.accounts where username = 'cloud6'")
            check('registration creates the online account (with mobile number)', len(acct) == 1 and acct[0]['phone'] == '9876500001' and acct[0]['standard'] == 6)
            synced(a)
            check('a new online account shows no “फक्त या उपकरणावर” banner', a.get_by_text('ही माहिती फक्त या उपकरणावर आहे.').count() == 0)
            go(a, '/settings/app')
            a.get_by_role('button', name='नमुना माहिती जोडा').click()
            a.wait_for_timeout(1500)
            go(a, '/students')
            a.get_by_role('link', name=re.compile('सई महेश देशमुख — माहिती पहा')).first.click()
            a.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
            sid = a.url.split('/')[-1]
            go(a, f'/students/{sid}/edit')
            a.get_by_label(re.compile('^विद्यार्थ्याचे पूर्ण नाव')).fill('क्लाउड चाचणी विद्यार्थिनी')
            a.get_by_label('आधार क्रमांक').fill('234123412346')
            a.get_by_role('button', name='जतन करा', exact=True).click()
            a.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
            n_students = wait_until(lambda: (sql("select count(*)::int as n from private.records where tbl = 'students' and not deleted")[0]['n'] >= 10) and sql("select count(*)::int as n from private.records where tbl = 'students' and data->>'fullName' = 'क्लाउड चाचणी विद्यार्थिनी'")[0]['n'] == 1, 30)
            check('device A sends students, marks and the edit to the server', bool(n_students))
            tbls = {r['tbl'] for r in sql('select distinct tbl from private.records')}
            check('every kind of record is stored online', {'classes', 'students', 'assessments', 'remarks', 'remarkLibrary', 'meta'} <= tbls, ', '.join(sorted(tbls)))
            a.screenshot(path=os.path.join(OUT, 'A-after-edit.png'))

            # ---------------- device B (mobile): same login, same data ----------------
            cb, b, prof = device(p, 'B', mobile=True)
            profiles.append(prof)
            b.goto(BASE)
            login(b, 'cloud6', 'pass6666')
            go(b, '/students')
            expect(b.get_by_text('क्लाउड चाचणी विद्यार्थिनी', exact=True)).to_be_visible(timeout=20000)
            b.screenshot(path=os.path.join(OUT, 'B-students.png'))
            count_b = b.locator('a[aria-label$="— माहिती पहा"]').count()
            check('device B (phone) logs in with the same ID and sees all students', count_b >= 10, f'{count_b} students')
            go(b, f'/students/{sid}')
            expect(b.get_by_text('2341 2341 2346')).to_be_visible()
            check('… including the details entered on A (आधार)', True)

            # edit on B → appears on A
            go(b, f'/students/{sid}/edit')
            b.get_by_label('पत्ता').fill('मु. पो. B वरून बदललेला पत्ता')
            b.get_by_role('button', name='जतन करा', exact=True).click()
            b.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
            ok = wait_until(lambda: sql(f"select count(*)::int as n from private.records where tbl = 'students' and id = '{sid}' and data->>'address' like '%B वरून%'")[0]['n'] == 1, 30)
            check('device B sends its edit', bool(ok))
            badge(a).first.click()  # "sync now"
            go(a, f'/students/{sid}')
            expect(a.get_by_text('मु. पो. B वरून बदललेला पत्ता')).to_be_visible(timeout=20000)
            check('device A receives the edit made on B', True)

            # reports on B are built from the synced data
            go(b, f'/reports/progress-card?student={sid}')
            b.wait_for_selector('.report-page-wrap .a4', timeout=20000)
            txt = '\n'.join(b.locator('.report-page-wrap').all_inner_texts())
            check('reports on B use the synced data', 'क्लाउड चाचणी विद्यार्थिनी' in txt and '234123412346' in txt)

            # ---------------- forgot password on B ----------------
            go(b, '/')
            logout(b)
            b.get_by_role('button', name='पासवर्ड / वापरकर्ता नाव विसरलात?').click()
            b.get_by_label(re.compile('^मोबाईल नंबर')).fill('98765 00001')
            b.get_by_role('button', name='OTP पाठवा').click()
            expect(b.get_by_text('या नंबरवर OTP पाठवला आहे')).to_be_visible(timeout=20000)
            code = wait_until(lambda: last_otp('9876500001'), 10)
            check('OTP sent to the registered mobile number', bool(code))
            b.get_by_label(re.compile('^OTP')).fill('000000' if code != '000000' else '111111')
            b.get_by_role('button', name='पुढे').click()
            expect(b.get_by_text('OTP चुकीचा आहे.', exact=False)).to_be_visible()
            check('a wrong OTP is refused', True)
            b.get_by_label(re.compile('^OTP')).fill(code)
            b.get_by_role('button', name='पुढे').click()
            expect(b.get_by_test_id('recovered-username')).to_have_text('cloud6')
            check('after the OTP the login ID is shown (forgotten username)', True)
            b.screenshot(path=os.path.join(OUT, 'B-recover.png'))
            b.get_by_label(re.compile('^नवीन पासवर्ड( \\*)?$')).fill('newpass66')
            b.get_by_label(re.compile('^नवीन पासवर्ड पुन्हा')).fill('newpass66')
            b.get_by_role('button', name='नवीन पासवर्ड ठेवा').click()
            expect(b.get_by_text('नवीन पासवर्ड ठेवला.', exact=False)).to_be_visible()
            check('new password saved; back to login with the ID filled in', b.locator('#login-user').input_value() == 'cloud6')
            login(b, 'cloud6', 'pass6666', expect_ok=False)
            expect(b.get_by_text(re.compile('हा पासवर्ड बदलला आहे|वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे'))).to_be_visible()
            check('the old password no longer works', True)
            login(b, 'cloud6', 'newpass66')
            check('the new password works', b.locator('main#main').count() == 1)

            # A was signed out of syncing by the reset
            badge(a).first.click()
            expect(a.locator('header').get_by_text('पुन्हा लॉगिन करा')).to_be_visible(timeout=20000)
            check('device A asks to log in again after the password reset (data stays on A)', a.get_by_text('क्लाउड चाचणी विद्यार्थिनी').count() > 0)
            logout(a)
            login(a, 'cloud6', 'newpass66')
            synced(a)
            check('A logs in with the new password and syncs again', True)

            # ---------------- device C: account made without internet goes online ----------------
            cc, c, prof = device(p, 'C')
            profiles.append(prof)
            cc.route(re.compile(r'^http://localhost:54321/.*'), lambda r: r.abort())
            c.goto(BASE)
            register(c, 'सातवी', 'अ', 'श्री. नमुना शिक्षक', 'local7', 'pass7777', '9876500002')
            expect(c.get_by_text('ही माहिती फक्त या उपकरणावर आहे.', exact=False)).to_be_visible()
            check('without internet the account is created on the device, with a prompt to go online', sql("select count(*)::int as n from private.accounts where username = 'local7'")[0]['n'] == 0)
            go(c, '/students/new')
            c.get_by_label(re.compile('^विद्यार्थ्याचे पूर्ण नाव')).fill('ऑफलाइन नोंद विद्यार्थी')
            c.get_by_role('button', name='जतन करा', exact=True).click()
            c.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
            cc.unroute(re.compile(r'^http://localhost:54321/.*'))
            c.get_by_role('button', name='ऑनलाइन खाते सुरू करा').click()
            dlg = c.locator('dialog[open]')
            check('the mobile number given at registration is filled in', dlg.get_by_label(re.compile('^मोबाईल नंबर')).input_value() == '9876500002')
            dlg.get_by_role('button', name='सुरू करा').click()
            expect(c.get_by_text('ऑनलाइन खाते सुरू झाले.', exact=False)).to_be_visible(timeout=20000)
            synced(c)
            ok = wait_until(lambda: sql("select count(*)::int as n from private.records r join private.accounts a on a.id = r.account_id where a.username = 'local7' and r.tbl = 'students' and r.data->>'fullName' = 'ऑफलाइन नोंद विद्यार्थी'")[0]['n'] == 1, 30)
            check('its data goes online with the same login', bool(ok))
            check('the banner is gone', c.get_by_text('ही माहिती फक्त या उपकरणावर आहे.').count() == 0)

            # ---------------- a new device while the service is unreachable ----------------
            cd, d, prof = device(p, 'D')
            profiles.append(prof)
            cd.route(re.compile(r'^http://localhost:54321/.*'), lambda r: r.abort())
            d.goto(BASE)
            login(d, 'cloud6', 'newpass66', expect_ok=False)
            expect(d.get_by_text('ऑनलाइन सेवेशी संपर्क होऊ शकला नाही', exact=False)).to_be_visible(timeout=30000)
            check('a new device without the service says so (no wrong-password message)', True)

            for x in (ca, cb, cc, cd):
                x.close()
    finally:
        preview.terminate()
        backend.terminate()
        try:
            backend.wait(15)
        except Exception:
            backend.kill()
        for prof in profiles:
            shutil.rmtree(prof, ignore_errors=True)

    print(f'\n{sum(1 for r in results if r[1])}/{len(results)} checks passed')
    if console_errors:
        print('console errors:', *console_errors[:20], sep='\n  ')


if __name__ == '__main__':
    try:
        main()
    except AssertionError as e:
        print(f'\nCLOUD E2E FAILED at: {e}')
        if console_errors:
            print('console errors:', *console_errors[:20], sep='\n  ')
        sys.exit(1)
