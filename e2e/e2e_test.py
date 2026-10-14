"""
End-to-end test for CCE नोंदवही (Playwright for Python + Chromium).

Follows the required offline procedure:
  login online → add student → marks → attendance → remarks → report PDF →
  internet OFF → refresh → login → data still there → edit marks → PDF →
  internet ON → continues normally.
Also checks: two-teacher isolation, validation messages, backup/restore,
school leaving certificate, admin password reset, mobile + desktop screens.

Usage:
  npm run build && npx vite preview --port 4173 --strictPort &
  python3 e2e/e2e_test.py            # BASE_URL=http://localhost:4173/ by default
Outputs screenshots and PDFs to e2e/out/.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

from playwright.sync_api import Page, expect, sync_playwright

BASE = os.environ.get('BASE_URL', 'http://localhost:4173/')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PW = re.compile(r'^पासवर्ड( \*)?$')
PW2 = re.compile(r'^पासवर्ड पुन्हा( \*)?$')
STUDENT = 'आरव संजय पाटील'
STUDENT2 = 'सई महेश देशमुख'

console_errors: list[str] = []
results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = ''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail else ''), flush=True)
    if not cond:
        raise AssertionError(name)


def shot(pg: Page, name: str, full=True):
    pg.screenshot(path=os.path.join(OUT, f'{name}.png'), full_page=full)


def go(pg: Page, path: str):
    pg.goto(BASE + '#' + path)


def pdf_pages(path: str) -> int:
    out = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', out)
    return int(m.group(1)) if m else 0


def setup(pg: Page):
    """First run: the headmaster sets up the school + admin account (optional path)."""
    pg.goto(BASE)
    pg.wait_for_selector('text=नवीन शिक्षक खाते', timeout=20000)
    shot(pg, '01-first-run-register')
    check('first run opens teacher registration', pg.get_by_role('radio', name='इयत्ता सातवी').count() == 1)
    pg.get_by_role('button', name='आधी शाळेची मांडणी करा').click()
    pg.get_by_label(re.compile('^शाळेचे नाव')).fill('जिल्हा परिषद प्राथमिक शाळा नमुनागाव')
    pg.get_by_label('UDISE क्रमांक').fill('27250800000')
    pg.get_by_label('व्यवस्थापन / संस्था').fill('जिल्हा परिषद, पुणे')
    pg.get_by_label('तालुका').fill('हवेली')
    pg.get_by_label('जिल्हा').fill('पुणे')
    pg.get_by_label('मुख्याध्यापकाचे नाव').fill('श्रीम. सुनंदा पाटील')
    pg.get_by_role('button', name='पुढील').click()
    pg.get_by_label(PW).fill('admin123')
    pg.get_by_label(PW2).fill('admin123')
    pg.get_by_role('button', name='मांडणी पूर्ण करा').click()
    pg.wait_for_selector('#login-user', timeout=30000)
    check('headmaster set-up (school + admin) on first run', True)


def register(pg: Page, std_word: str, section: str, name: str, user: str, password: str, open_form=True):
    """A teacher creates their own account: standard → section/name → username/password."""
    if open_form:
        pg.get_by_role('button', name='नवीन खाते तयार करा').click()
    pg.get_by_role('radio', name=f'इयत्ता {std_word}').click()
    pg.get_by_label('तुकडी').select_option(section)
    pg.get_by_label(re.compile('^वर्गशिक्षकाचे नाव')).fill(name)
    pg.get_by_label(re.compile('^वापरकर्ता नाव')).fill(user)
    pg.get_by_label(PW).fill(password)
    pg.get_by_label(PW2).fill(password)
    pg.get_by_role('button', name='खाते तयार करा').click()


def login(pg: Page, user: str, password: str, expect_ok=True):
    pg.wait_for_selector('#login-user', timeout=20000)
    pg.locator('#login-user').fill(user)
    pg.locator('#login-pass').fill(password)
    pg.get_by_role('button', name='लॉगिन करा').click()
    if expect_ok:
        pg.wait_for_selector('main#main', timeout=20000)


def logout(pg: Page):
    pg.locator('aside').get_by_role('button', name='बाहेर पडा').click()
    pg.locator('dialog[open]').get_by_role('button', name='बाहेर पडा').click()
    pg.wait_for_selector('#login-user', timeout=20000)


def download(pg: Page, button_name: str, path: str):
    with pg.expect_download(timeout=90000) as d:
        pg.get_by_role('button', name=button_name).first.click()
    d.value.save_as(path)
    if path.endswith('.pdf'):
        stats = pg.evaluate('() => globalThis.__cceLastPdf')
        check(f'no broken Marathi glyphs in {os.path.basename(path)}', stats and stats['glyphs'] > 50 and stats['missingGlyphs'] == 0, str(stats))
    return path


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True)
    profile = tempfile.mkdtemp(prefix='cce-e2e-')
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(profile, viewport={'width': 1280, 'height': 900}, accept_downloads=True, locale='mr-IN')
        pg = ctx.pages[0]
        pg.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: console_errors.append(f'pageerror: {e}'))

        # ---------------- setup & login ----------------
        setup(pg)
        check('default academic year is 2026-27', pg.get_by_text('सन : 2026-27').count() > 0)
        # teachers create their own accounts (choose standard, then username + password)
        register(pg, 'सातवी', 'ब', 'श्री. राजेश जाधव', 'teacher7', 'pass7777')
        pg.wait_for_selector('main#main', timeout=20000)
        expect(pg.get_by_text('नमस्कार, श्री. राजेश जाधव')).to_be_visible()
        check('teacher self-registration (इयत्ता सातवी, तुकडी ब) logs in to its own class', pg.get_by_text('इयत्ता ७ वी').count() > 0)
        logout(pg)
        pg.get_by_role('button', name='नवीन खाते तयार करा').click()
        shot(pg, '02-register')
        register(pg, 'पाचवी', 'अ', 'श्रीम. कविता शिंदे', 'teacher7', 'pass5555', open_form=False)
        expect(pg.get_by_text('हे वापरकर्ता नाव आधीच वापरले आहे. दुसरे नाव निवडा.')).to_be_visible()
        check('registration refuses a username that is taken', True)
        pg.get_by_label(re.compile('^वापरकर्ता नाव')).fill('teacher5')
        pg.get_by_role('button', name='खाते तयार करा').click()
        pg.wait_for_selector('main#main', timeout=20000)
        check('second teacher registers for इयत्ता पाचवी', pg.get_by_text('नमस्कार, श्रीम. कविता शिंदे').count() > 0 and pg.get_by_text('इयत्ता ५ वी').count() > 0)
        logout(pg)
        shot(pg, '02-login-desktop')
        login(pg, 'teacher7', 'nope', expect_ok=False)
        expect(pg.get_by_text('वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे.')).to_be_visible()
        check('wrong password is rejected', True)
        login(pg, 'teacher7', 'pass7777')
        expect(pg.get_by_text('नमस्कार, श्री. राजेश जाधव')).to_be_visible()
        check('teacher7 login works and sees Class 7', pg.get_by_text('सातवी').count() > 0 and pg.get_by_text('इयत्ता ७ वी').count() > 0)
        shot(pg, '03-dashboard-empty')

        # ---------------- students ----------------
        go(pg, '/students/new')
        pg.get_by_label(re.compile('^विद्यार्थ्याचे पूर्ण नाव')).fill('')
        pg.get_by_role('button', name='जतन करा', exact=True).click()
        expect(pg.get_by_text('कृपया विद्यार्थ्याचे नाव भरा.')).to_be_visible()
        check('student name is required (Marathi message)', True)
        pg.get_by_label(re.compile('^विद्यार्थ्याचे पूर्ण नाव')).fill(STUDENT)
        pg.get_by_label('जन्मतारीख').fill('2014-09-22')
        pg.get_by_label('रजिस्टर क्रमांक (जनरल रजि.)').fill('4801')
        pg.get_by_label('आईचे नाव').fill('सुनीता पाटील')
        pg.get_by_label('वडिलांचे नाव').fill('संजय पाटील')
        pg.get_by_label('जात प्रवर्ग').select_option('OBC')
        pg.get_by_role('button', name='जतन करा व नवीन जोडा').click()
        pg.wait_for_timeout(600)
        pg.get_by_label(re.compile('^विद्यार्थ्याचे पूर्ण नाव')).fill(STUDENT2)
        pg.get_by_label(re.compile('^लिंग')).select_option('F')
        pg.get_by_label('हजेरी क्रमांक').fill('1')
        expect(pg.get_by_text('हा हजेरी क्रमांक आधीच दुसऱ्या विद्यार्थ्याला दिला आहे.')).to_be_visible()
        check('duplicate roll number warning', True)
        pg.get_by_label('हजेरी क्रमांक').fill('2')
        pg.get_by_label('जात प्रवर्ग').select_option('SC')
        pg.get_by_role('button', name='जतन करा', exact=True).click()
        pg.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
        id2 = pg.url.split('/')[-1]
        go(pg, '/students')
        expect(pg.get_by_text(STUDENT, exact=True)).to_be_visible()
        expect(pg.get_by_text(STUDENT2, exact=True)).to_be_visible()
        pg.get_by_placeholder('नावाने, हजेरी क्र. किंवा रजिस्टर क्र. ने शोधा').fill('4801')
        check('student search by register number', pg.get_by_text(STUDENT2, exact=True).count() == 0 and pg.get_by_text(STUDENT, exact=True).count() == 1)
        pg.get_by_role('link', name=f'{STUDENT} — माहिती पहा').click()
        pg.wait_for_url(re.compile(r'#/students/[0-9a-f-]{36}$'))
        id1 = pg.url.split('/')[-1]
        check('student CRUD: create, view, search', True)

        # ---------------- formative marks ----------------
        go(pg, '/formative?term=1&subject=marathi')
        pg.get_by_role('radio', name='तक्ता').click()
        tools = {'निरीक्षण': '5', 'तोंडीकाम': '4', 'प्रात्यक्षिक': '5', 'उपक्रम': '3', 'प्रकल्प': '4', 'चाचणी': '5', 'स्वाध्याय': '4.5', 'इतर': '5'}
        for t, v in tools.items():
            pg.get_by_label(f'{STUDENT} — {t} (कमाल 5)').fill(v)
        cell = pg.get_by_label(f'{STUDENT2} — निरीक्षण (कमाल 5)')
        cell.fill('9')
        expect(pg.get_by_text('प्राप्त गुण हे कमाल गुणांपेक्षा जास्त असू शकत नाहीत.')).to_be_visible()
        check('marks above maximum are rejected', cell.get_attribute('aria-invalid') == 'true')
        cell.fill('4')
        pg.wait_for_timeout(400)
        shot(pg, '04-formative-table')

        # ---------------- summative marks ----------------
        go(pg, '/summative?term=1&subject=marathi')
        pg.get_by_role('radio', name='तक्ता').click()
        pg.get_by_label(f'{STUDENT} — तोंडी (कमाल 10)').fill('8')
        pg.get_by_label(f'{STUDENT} — लेखी (कमाल 50)').fill('42')
        pg.wait_for_timeout(500)
        row = pg.locator('tr', has_text=STUDENT)
        # आकारिक 35.5 + संकलित 50 = 85.5 → अ-2 (rounded 86)
        check('automatic total अ+ब and grade', row.get_by_text('85.5').count() > 0 and row.get_by_text('अ-2').count() > 0, row.inner_text().replace('\n', ' '))
        shot(pg, '05-summative-table')

        # ---------------- attendance ----------------
        go(pg, '/attendance?tab=monthly')
        pg.get_by_label('महिना').select_option('2026-06')
        pg.get_by_label('एकूण कामाचे दिवस').fill('20')
        pg.wait_for_timeout(400)
        pres = pg.get_by_label(f'{STUDENT} — हजर दिवस')
        pres.fill('25')
        expect(pg.get_by_text('हजर दिवस हे कामाच्या दिवसांपेक्षा जास्त असू शकत नाहीत.').first).to_be_visible()
        check('attendance cannot exceed working days', True)
        pres.fill('18')
        pg.get_by_label(f'{STUDENT2} — हजर दिवस').fill('20')
        pg.wait_for_timeout(400)
        check('attendance percentage auto-calculated', pg.locator('tr', has_text=STUDENT).get_by_text('90').count() > 0)
        go(pg, '/attendance?tab=daily')
        pg.get_by_role('radiogroup', name=f'{STUDENT2} — हजेरी').get_by_role('radio', name='गैरहजर').click()
        pg.wait_for_timeout(400)
        go(pg, '/')
        expect(pg.get_by_text('आज अनुपस्थित')).to_be_visible()
        check('daily attendance feeds the dashboard', pg.locator('div.panel', has_text='आज अनुपस्थित').get_by_text('1', exact=True).count() > 0)
        shot(pg, '06-dashboard')

        # ---------------- remarks ----------------
        go(pg, f'/remarks?term=1&student={id1}')
        sel = pg.get_by_label('प्रथम भाषा: मराठी — वर्णनात्मक नोंद निवडा')
        sel.select_option(index=2)
        chosen = sel.input_value()
        check('remark dropdown fills the remark', bool(chosen))
        pg.get_by_label('द्वितीय भाषा: हिंदी', exact=True).fill('हिंदी में अच्छी तरह बात करता है।')
        pg.get_by_role('button', name='ही नोंद वर्णनात्मक नोंद संचात जोडा').first.click()
        expect(pg.get_by_text('नोंद संचात जोडली — पुढे ड्रॉपडाऊनमध्ये दिसेल.')).to_be_visible()
        check('custom remark added to the remark library', True)
        pg.wait_for_timeout(800)
        go(pg, f'/remarks?term=1&student={id2}')
        opts = pg.get_by_label('द्वितीय भाषा: हिंदी — वर्णनात्मक नोंद निवडा').locator('option').all_inner_texts()
        check('library remark shown in feminine form for a girl', 'हिंदी में अच्छी तरह बात करती है।' in opts)

        # ---------------- report PDF (online) ----------------
        go(pg, f'/reports/progress-card?student={id1}')
        pg.wait_for_selector('.report-page-wrap .a4')
        pg.wait_for_timeout(800)
        shot(pg, '07-progress-card-preview', full=False)
        f = download(pg, 'PDF तयार करा', os.path.join(OUT, 'progress-card-online.pdf'))
        check('progress card PDF: मुखपृष्ठ + श्रेणी page', pdf_pages(f) == 2)

        # ---------------- offline ----------------
        ready = pg.evaluate("""async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }""")
        check('service worker installed', ready)
        pg.reload()
        pg.wait_for_selector('main#main', timeout=20000)
        controlled = pg.evaluate('() => !!navigator.serviceWorker.controller')
        check('page controlled by service worker', controlled)
        logout(pg)
        ctx.set_offline(True)
        pg.reload()
        pg.wait_for_selector('#login-user', timeout=20000)
        expect(pg.locator(':text("ऑफलाइन"):visible').first).to_be_visible()
        shot(pg, '08-login-offline')
        check('app loads with internet OFF', True)
        login(pg, 'teacher7', 'pass7777')
        check('offline login works', pg.get_by_text('नमस्कार, श्री. राजेश जाधव').count() > 0)
        go(pg, '/students')
        expect(pg.get_by_text(STUDENT, exact=True)).to_be_visible()
        check('data remains after offline refresh', True)
        go(pg, '/formative?term=1&subject=marathi')
        pg.get_by_role('radio', name='तक्ता').click()
        c = pg.get_by_label(f'{STUDENT} — उपक्रम (कमाल 5)')
        check('saved marks present offline', c.input_value() == '3')
        c.fill('5')
        pg.wait_for_timeout(500)
        pg.reload()
        pg.wait_for_selector('main#main')
        pg.get_by_role('radio', name='तक्ता').click()
        check('offline mark edit autosaved (survives refresh)', pg.get_by_label(f'{STUDENT} — उपक्रम (कमाल 5)').input_value() == '5')
        go(pg, f'/reports/student-wise?term=1&student={id1}')
        pg.wait_for_selector('.report-page-wrap .a4')
        pg.wait_for_timeout(800)
        f = download(pg, 'PDF तयार करा', os.path.join(OUT, 'student-wise-offline.pdf'))
        check('PDF generated offline (Marathi engine cached)', pdf_pages(f) == 1)
        ctx.set_offline(False)
        pg.wait_for_timeout(500)
        go(pg, '/')
        expect(pg.locator(':text("ऑनलाइन"):visible').first).to_be_visible()
        check('back online — app continues normally', True)

        # ---------------- isolation ----------------
        logout(pg)
        login(pg, 'teacher5', 'pass5555')
        expect(pg.get_by_text('नमस्कार, श्रीम. कविता शिंदे')).to_be_visible()
        check('teacher5 login works and sees Class 5', pg.get_by_text('पाचवी').count() > 0)
        go(pg, '/students')
        expect(pg.get_by_text('अजून विद्यार्थी नाहीत.')).to_be_visible()
        check('teacher5 does not see Class 7 students', pg.get_by_text(STUDENT).count() == 0)
        go(pg, f'/students/{id1}')
        expect(pg.get_by_text('या माहितीमध्ये प्रवेश करण्याची परवानगी नाही.')).to_be_visible()
        check('teacher5 cannot open a Class 7 student by URL', True)
        go(pg, f'/students/{id1}/edit')
        expect(pg.get_by_text('या माहितीमध्ये प्रवेश करण्याची परवानगी नाही.')).to_be_visible()
        check('teacher5 cannot edit a Class 7 student by URL', True)
        go(pg, '/formative')
        expect(pg.get_by_text('गुण भरण्यासाठी आधी विद्यार्थी जोडा.')).to_be_visible()
        go(pg, '/settings/subjects')
        pg.wait_for_selector('text=विषय — इयत्ता पाचवी')
        names = pg.evaluate("() => [...document.querySelectorAll('input')].map(i => i.value)")
        check('Class 5 has its own subjects', 'परिसर अभ्यास भाग 1' in names and 'सामान्य विज्ञान' not in names)
        logout(pg)

        # ---------------- backup / restore (teacher7) ----------------
        login(pg, 'teacher7', 'pass7777')
        go(pg, '/settings/backup')
        f = download(pg, 'बॅकअप डाउनलोड करा (.json)', os.path.join(OUT, 'backup-class7.json'))
        check('backup downloaded', os.path.getsize(f) > 1000)
        go(pg, f'/students/{id2}')
        pg.get_by_role('button', name='हटवा').click()
        pg.locator('dialog[open]').get_by_role('button', name='हटवा').click()
        pg.wait_for_url(re.compile(r'#/students$'))
        expect(pg.get_by_text(STUDENT2, exact=True)).to_have_count(0)
        go(pg, '/settings/backup')
        with pg.expect_file_chooser() as fc:
            pg.locator('label.btn', has_text='बॅकअप फाइल निवडा').click()
        fc.value.set_files(f)
        pg.locator('dialog[open]').get_by_role('button', name='पुनर्संचयित करा').click()
        expect(pg.get_by_text('2 विद्यार्थ्यांची माहिती पुनर्संचयित झाली.')).to_be_visible()
        go(pg, '/students')
        expect(pg.get_by_text(STUDENT2, exact=True)).to_be_visible()
        check('restore brings back deleted data', True)

        # ---------------- every report renders + PDF ----------------
        keys = ['cover', 'index', 'student-list', 'attendance', 'formative', 'summative', 'subject-wise', 'student-wise', 'class-register', 'class-ab', 'remarks', 'progress-card', 'annual-marksheet', 'result-sheet', 'grade-wise', 'category-wise', 'result-summary']
        page_text = {}
        for k in keys:
            go(pg, f'/reports/{k}')
            pg.wait_for_selector('.report-page-wrap .a4', timeout=20000)
            pg.wait_for_timeout(500)
            page_text[k] = '\n'.join(pg.locator('.report-page-wrap').all_inner_texts())
            f = download(pg, 'PDF तयार करा', os.path.join(OUT, f'report-{k}.pdf'))
            n = pdf_pages(f)
            check(f'report "{k}" PDF', n >= 1, f'{n} page(s)')
        both = lambda k: 'प्रथम सत्र' in page_text[k] and 'द्वितीय सत्र' in page_text[k]
        pc = page_text['progress-card']
        check('प्रगती कार्ड: मुखपृष्ठ (माहिती + मासिक उपस्थिती) and page 2 (श्रेणी, 3 विशेष नोंदी, 3 स्वाक्षऱ्या)', all(w in pc for w in ['प्रगती पत्रक', 'विद्यार्थ्याची माहिती', 'मासिक उपस्थिती', 'विषयनिहाय श्रेणी', 'विशेष नोंद', 'आवड / छंद', 'सुधारणा आवश्यक', 'पालक स्वाक्षरी', 'वर्गशिक्षक स्वाक्षरी', 'मुख्याध्यापक स्वाक्षरी']))
        check('नोंदपत्र: both सत्र on one page per student', both('student-wise') and 'प्राप्त गुण' in page_text['student-wise'] and 'गुण पैकी' in page_text['student-wise'])
        check('वर्णनात्मक नोंद वही: both सत्र side by side', both('remarks') and 'सुधारणा आवश्यक' in page_text['remarks'])
        check('निकाल पत्रक shows both सत्र per subject', both('result-sheet') and 'संवर्ग' in page_text['result-sheet'])
        check('विषयनिहाय and जातीनिहाय संकलन तक्ते show both सत्र', both('grade-wise') and both('category-wise') and 'अनुसूचित जाती' in page_text['category-wise'])
        idx = page_text['index']
        check('अनुक्रमणिका: only school, इयत्ता, year, अनुक्रमांक, name, परीक्षा क्रमांक', all(w in idx for w in ['शाळेचे नाव', 'इयत्ता', 'शैक्षणिक वर्ष', 'अनुक्रमांक', 'परीक्षा क्रमांक', STUDENT]) and not any(w in idx for w in ['जन्मतारीख', 'रजि', 'युडायस', 'पृष्ठ क्र']), idx[:200].replace('\n', ' '))

        go(pg, '/reports/subject-wise?term=1&subject=marathi&orientation=landscape')
        pg.wait_for_selector('.report-page-wrap.landscape .a4', timeout=20000)
        pg.wait_for_timeout(500)
        f = download(pg, 'PDF तयार करा', os.path.join(OUT, 'report-subject-wise-landscape.pdf'))
        info = subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout
        check('subject-wise register printable on A4 landscape', '842' in info.split('Page size:')[1].split('x')[0], info.split('Page size:')[1].strip()[:30])

        # ---------------- school leaving certificate ----------------
        go(pg, f'/certificates/new?student={id2}')
        expect(pg.get_by_label('जन्मदिनांक (अक्षरी)')).to_be_visible()
        pg.get_by_label('जन्मदिनांक (अंकी)').fill('2014-11-07')
        check('date of birth in Marathi words', pg.get_by_label('जन्मदिनांक (अक्षरी)').input_value() == 'सात नोव्हेंबर दोन हजार चौदा')
        pg.get_by_label('शाळा सोडण्याचे कारण').select_option('पुढील शिक्षणासाठी')
        pg.get_by_role('button', name='जतन करा व पूर्वदृश्य').click()
        pg.wait_for_selector('.report-page-wrap .a4', timeout=20000)
        pg.wait_for_timeout(600)
        shot(pg, '09-lc-preview', full=False)
        f = download(pg, 'PDF तयार करा', os.path.join(OUT, 'leaving-certificate.pdf'))
        check('school leaving certificate PDF', pdf_pages(f) == 1)
        pg.get_by_role('button', name='बंद करा').first.click()
        logout(pg)

        # ---------------- admin ----------------
        login(pg, 'admin', 'admin123')
        go(pg, '/admin/teachers')
        expect(pg.get_by_text('teacher7', exact=True)).to_be_visible()
        expect(pg.get_by_text('teacher5', exact=True)).to_be_visible()
        check('admin cannot see student data', pg.get_by_text(STUDENT).count() == 0)
        pg.locator('tr', has_text='teacher5').get_by_role('button', name='पासवर्ड').click()
        pg.locator('dialog[open]').get_by_label('नवीन तात्पुरता पासवर्ड').fill('temp5555')
        pg.locator('dialog[open]').get_by_role('button', name='जतन करा').click()
        expect(pg.get_by_text('नवीन पासवर्ड ठेवला.', exact=False)).to_be_visible()
        logout(pg)
        login(pg, 'teacher5', 'temp5555')
        expect(pg.get_by_role('heading', name='नवीन पासवर्ड ठेवा')).to_be_visible()
        dlg = pg.locator('dialog[open]')
        dlg.get_by_label('सध्याचा पासवर्ड').fill('temp5555')
        dlg.get_by_label(re.compile(r'^नवीन पासवर्ड( \*)?$')).fill('newpass55')
        dlg.get_by_label('नवीन पासवर्ड पुन्हा').fill('newpass55')
        dlg.get_by_role('button', name='पासवर्ड बदला').click()
        expect(pg.get_by_text('पासवर्ड बदलला.')).to_be_visible()
        check('admin reset → teacher must set a new password', True)
        logout(pg)

        # ---------------- mobile screens ----------------
        mob = ctx.new_page()
        mob.set_viewport_size({'width': 390, 'height': 844})
        mob.goto(BASE)
        login(mob, 'teacher7', 'pass7777')
        for path, name in [('/', 'm-dashboard'), ('/students', 'm-students'), ('/formative?term=1&subject=marathi', 'm-formative'), ('/remarks?term=1', 'm-remarks'), ('/attendance?tab=monthly', 'm-attendance'), ('/reports', 'm-reports')]:
            mob.goto(BASE + '#' + path)
            mob.wait_for_timeout(900)
            shot(mob, name)
        width = mob.evaluate('() => document.documentElement.scrollWidth')
        check('no horizontal page scroll on mobile', width <= 390, f'scrollWidth={width}')
        mob.get_by_role('button', name='मेनू उघडा').click()
        expect(mob.get_by_role('dialog', name='मेनू')).to_be_visible()
        shot(mob, 'm-drawer', full=False)
        check('mobile drawer menu opens', True)
        ctx.close()

    shutil.rmtree(profile, ignore_errors=True)
    noise = [e for e in console_errors if 'Failed to load resource' not in e and 'net::ERR_INTERNET_DISCONNECTED' not in e]
    check('no console errors', not noise, '; '.join(noise[:5]))
    passed = sum(1 for _, ok, _ in results if ok)
    print(f'\n{passed}/{len(results)} checks passed')


if __name__ == '__main__':
    try:
        main()
    except AssertionError as e:
        print(f'\nE2E FAILED at: {e}')
        sys.exit(1)
