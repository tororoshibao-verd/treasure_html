const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "JavaScript/screen.js"), "utf8");
const movementButtons = ["button_left", "button_right", "button_back"];

function gameState(floorCount, overrides = {}) {
    return {
        floorCount, lifeCount: 3, points: 0, gameCount: floorCount - 1,
        isFinished: false, endingType: null, ...overrides
    };
}

// 実際の画面コードを、画像の読み込みと時間を制御できる環境で動かす。
function createScreen(delayedImage) {
    const elements = new Map();
    const imageChanges = [];
    const preloadedImages = [];
    const timers = new Map();
    let now = 0;
    let timerId = 0;
    let resolveImage;
    let rejectImage;
    const imageReady = new Promise(function (resolve, reject) {
        resolveImage = resolve;
        rejectImage = reject;
    });

    function createElement(id) {
        const classes = new Set();
        const listeners = new Map();
        let source = "";
        return {
            disabled: false, hidden: false, open: false,
            attributes: {}, dataset: {}, children: [], textContent: "",
            classList: {
                add: (name) => classes.add(name),
                remove: (name) => classes.delete(name),
                contains: (name) => classes.has(name),
                toggle(name, active) {
                    if (active) classes.add(name);
                    else classes.delete(name);
                }
            },
            get src() { return source; },
            set src(value) {
                source = value;
                if (id === "dungeon-art") {
                    imageChanges.push({
                        src: value,
                        dark: elements.get("scene-blackout").classList.contains("is-dark")
                    });
                }
            },
            setAttribute(name, value) { this.attributes[name] = String(value); },
            querySelectorAll() { return this.children; },
            addEventListener(event, listener) {
                if (!listeners.has(event)) listeners.set(event, []);
                listeners.get(event).push(listener);
            },
            click() {
                if (!this.disabled) {
                    for (const listener of listeners.get("click") ?? []) listener({ target: this });
                }
            },
            focus() {},
            showModal() { this.open = true; },
            close() { this.open = false; }
        };
    }

    for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
        elements.set(match[1], createElement(match[1]));
    }
    elements.get("turn-pips").children = Array.from({ length: 5 }, () => createElement());
    const floorMap = html.match(/<ol[^>]*id="floor-map"[^>]*>([\s\S]*?)<\/ol>/)[1];
    elements.get("floor-map").children = Array.from(floorMap.matchAll(/<li\b/g), () => createElement());
    const window = {};
    const context = {
        window,
        document: {
            getElementById(id) {
                assert.ok(elements.has(id), "HTMLに存在しない要素: " + id);
                return elements.get(id);
            },
            activeElement: { tagName: "BODY" },
            addEventListener() {}
        },
        Image: class {
            constructor() { preloadedImages.push(this); }
            decode() { return this.src === delayedImage ? imageReady : Promise.resolve(); }
        },
        setTimeout(callback, milliseconds) {
            const id = ++timerId;
            timers.set(id, { at: now + milliseconds, callback });
            return id;
        }
    };
    vm.runInNewContext(script, context);

    const flush = () => new Promise(setImmediate);
    async function advance(milliseconds) {
        const target = now + milliseconds;
        while (true) {
            await flush();
            const next = [...timers].filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            now = next[1].at;
            timers.delete(next[0]);
            next[1].callback();
        }
        now = target;
        await flush();
    }

    return {
        update: window.gameScreen.update,
        element: (id) => elements.get(id),
        dark: () => elements.get("scene-blackout").classList.contains("is-dark"),
        image: () => elements.get("dungeon-art").src,
        imageChanges, preloadedImages, advance, flush, resolveImage, rejectImage
    };
}

function assertMovementDisabled(screen, disabled) {
    movementButtons.forEach((id) => assert.equal(screen.element(id).disabled, disabled, id));
    assert.equal(screen.element("button_reset").disabled, false);
}

test("初期表示は1階層の画像で、全6階層の画像を先読みする", () => {
    const screen = createScreen();
    screen.update(gameState(1));
    assert.equal(screen.image(), "./img/dungeon.png");
    assert.equal(screen.dark(), false);
    assert.equal(screen.preloadedImages.length, 6);
    assert.equal(screen.element("floor-map").children.length, 6);
    screen.preloadedImages.forEach((image) => {
        assert.ok(fs.existsSync(path.join(root, image.src)));
    });
    assertMovementDisabled(screen, false);
});

test("2〜5階層は完全な暗転中に画像を差し替え、暗転終了後に操作を戻す", async () => {
    const screen = createScreen();
    screen.update(gameState(1));
    for (let floor = 2; floor <= 5; floor += 1) {
        const previousImage = screen.image();
        screen.update(gameState(floor));
        assert.equal(screen.dark(), true);
        assert.equal(screen.image(), previousImage);
        assertMovementDisabled(screen, true);
        await screen.advance(160);
        assert.equal(screen.image(), "./img/dungeon-floor-" + floor + ".png");
        assert.equal(screen.dark(), true);
        assert.equal(screen.imageChanges.at(-1).dark, true);
        await screen.advance(119);
        assert.equal(screen.dark(), true);
        await screen.advance(1);
        assert.equal(screen.dark(), false);
        assertMovementDisabled(screen, true);
        await screen.advance(160);
        assertMovementDisabled(screen, false);
    }
    assert.match(screen.element("dungeon-art").alt, /第5階層/);
});

test("同じ階層で失敗したときは背景を切り替えない", async () => {
    const screen = createScreen();
    screen.update(gameState(1));
    screen.update(gameState(1, { lifeCount: 2, gameCount: 1 }));
    await screen.advance(500);
    assert.equal(screen.dark(), false);
    assert.equal(screen.imageChanges.length, 1);
    assert.equal(screen.element("hearts").attributes["aria-label"], "スタミナ2 / 3");
});

test("次の画像の読み込みが遅れても、読み込めるまで暗転を保つ", async () => {
    const screen = createScreen("./img/dungeon-floor-2.png");
    screen.update(gameState(1));
    screen.update(gameState(2));
    await screen.advance(1000);
    assert.equal(screen.dark(), true);
    assert.equal(screen.image(), "./img/dungeon.png");
    assertMovementDisabled(screen, true);
    screen.resolveImage();
    await screen.flush();
    assert.equal(screen.image(), "./img/dungeon-floor-2.png");
    assert.equal(screen.dark(), true);
    await screen.advance(280);
    assert.equal(screen.dark(), false);
    assertMovementDisabled(screen, false);
});

test("暗転開始直後に繰り返しやり直しても、古い階層の画像が表示されない", async () => {
    const screen = createScreen();
    screen.update(gameState(1));
    screen.update(gameState(2));
    await screen.advance(80);
    screen.update(gameState(1));
    // ゲーム側がリセットでボタンを再有効化した状況も再現する。
    movementButtons.forEach((id) => { screen.element(id).disabled = false; });
    screen.update(gameState(1));
    assertMovementDisabled(screen, true);
    await screen.advance(500);
    assert.equal(screen.image(), "./img/dungeon.png");
    assert.ok(screen.imageChanges.every((change) => change.src === "./img/dungeon.png"));
    assert.equal(screen.dark(), false);
    assertMovementDisabled(screen, false);
});

test("画像が切り替わった直後にやり直しても、最後は1階層の画像に戻る", async () => {
    const screen = createScreen();
    screen.update(gameState(1));
    screen.update(gameState(3));
    await screen.advance(160);
    assert.equal(screen.image(), "./img/dungeon-floor-3.png");
    screen.update(gameState(1));
    await screen.advance(440);
    assert.equal(screen.image(), "./img/dungeon.png");
    assert.equal(screen.dark(), false);
    assertMovementDisabled(screen, false);
});

test("切り替え中に探索が終了した場合、終了後の移動ボタンを再有効化しない", async () => {
    const screen = createScreen();
    screen.update(gameState(1));
    screen.update(gameState(5));
    await screen.advance(160);
    screen.update(gameState(5, { gameCount: 5, isFinished: true, endingType: "exhausted" }));
    await screen.advance(280);
    assert.equal(screen.image(), "./img/dungeon-floor-5.png");
    assert.equal(screen.dark(), false);
    assert.equal(screen.element("ending-banner").hidden, false);
    assertMovementDisabled(screen, true);
});

test("第6階層の庭園と一緒にクリア表示を見せ、やり直すと探索画面へ戻る", async () => {
    const screen = createScreen();
    screen.update(gameState(5));
    assert.equal(screen.element("route-choices").hidden, false);
    screen.update(gameState(6, { isFinished: true, endingType: "cleared" }));
    assert.equal(screen.element("route-choices").hidden, true);
    assert.equal(screen.element("ending-banner").hidden, true);
    assertMovementDisabled(screen, true);
    await screen.advance(160);
    assert.equal(screen.image(), "./img/dungeon-floor-6.png");
    assert.equal(screen.dark(), true);
    assert.equal(screen.imageChanges.at(-1).dark, true);
    assert.equal(screen.element("ending-banner").hidden, true);
    await screen.advance(120);
    assert.equal(screen.dark(), false);
    assert.equal(screen.element("ending-banner").hidden, false);
    assert.match(screen.element("location-text").textContent, /第6階層 ― 天空の庭園/);
    assert.ok(screen.element("floor-map").children.every((floor) => floor.classList.contains("visited")));
    await screen.advance(160);
    assertMovementDisabled(screen, true);

    screen.update(gameState(1));
    assert.equal(screen.element("route-choices").hidden, false);
    assert.equal(screen.element("ending-banner").hidden, true);
    await screen.advance(440);
    assert.equal(screen.image(), "./img/dungeon.png");
    assert.equal(screen.element("dungeon-scene").dataset.ending, undefined);
    assertMovementDisabled(screen, false);
});

test("画像の読み込みが失敗した場合も、暗転を解除して操作を戻す", async () => {
    const screen = createScreen("./img/dungeon-floor-2.png");
    screen.update(gameState(1));
    screen.update(gameState(2));
    screen.rejectImage(new Error("読み込み失敗"));
    await screen.advance(440);
    assert.equal(screen.dark(), false);
    assertMovementDisabled(screen, false);
});

test("暗転用の幕は黒・不透明で、ダンジョン全体を覆うスタイルを持つ", () => {
    const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
    const blackout = css.match(/\.scene-blackout\s*\{([^}]+)\}/)[1];
    assert.match(blackout, /background:\s*#000\s*;/);
    assert.match(blackout, /inset:\s*0\s*;/);
    assert.match(blackout, /z-index:\s*10\s*;/);
    assert.match(css, /\.scene-blackout\.is-dark\s*\{\s*opacity:\s*1\s*;/);
});
