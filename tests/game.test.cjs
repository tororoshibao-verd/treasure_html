const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const script = fs.readFileSync(path.join(root, "JavaScript/script.js"), "utf8");
const explorationButtons = ["button_left", "button_right", "button_back"];

// HTMLに存在する要素とjQueryの入出力だけを用意し、実際のゲームコードを実行する。
// ブラウザを使わず、クリック後の表示・画像・操作可否を確認するための補助。
function createGame() {
    const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [
        match[1], { content: "", attributes: {}, properties: { disabled: false }, handlers: {} }
    ]));
    let roll = 1;
    let screenState;

    function $(selector) {
        if (typeof selector === "function") {
            selector();
            return;
        }

        const targets = selector.split(",").map((part) => {
            const id = part.trim().replace(/^#/, "");
            assert.ok(elements.has(id), "HTMLに存在しない要素: " + id);
            return elements.get(id);
        });
        const collection = {
            text(value) {
                targets.forEach((element) => { element.content = String(value); });
                return collection;
            },
            html(value) {
                targets.forEach((element) => { element.content = String(value); });
                return collection;
            },
            attr(name, value) {
                targets.forEach((element) => { element.attributes[name] = value; });
                return collection;
            },
            prop(name, value) {
                targets.forEach((element) => { element.properties[name] = value; });
                return collection;
            },
            on(event, handler) {
                targets.forEach((element) => {
                    (element.handlers[event] ??= []).push(handler);
                });
                return collection;
            }
        };
        return collection;
    }

    const controlledMath = Object.create(Math);
    controlledMath.random = () => (roll - 0.5) / 100;
    vm.runInNewContext(script, {
        $, Math: controlledMath,
        window: { gameScreen: { update(state) { screenState = JSON.parse(JSON.stringify(state)); } } }
    });

    function click(id, force = false) {
        const element = elements.get(id);
        if (force || !element.properties.disabled) {
            for (const handler of element.handlers.click ?? []) {
                handler.call(element);
            }
        }
    }

    return {
        click,
        screenState: () => screenState,
        choose(direction, nextRoll = 1) {
            roll = nextRoll;
            click("button_" + direction);
        },
        read: (id) => elements.get(id).content,
        hearts: () => [1, 2, 3].map((i) => elements.get("heart_0" + i).attributes.src),
        disabled: (id) => elements.get(id).properties.disabled,
        snapshot: () => [...elements].map(([id, element]) => [
            id, element.content, { ...element.attributes }, { ...element.properties }
        ])
    };
}

function assertFinished(game) {
    explorationButtons.forEach((id) => assert.equal(game.disabled(id), true, id));
    assert.equal(game.disabled("button_reset"), false);
    assert.equal(game.screenState().isFinished, true);
    const result = game.snapshot();
    // 無効化済みのボタンにイベントが直接届いても状態を維持する。
    explorationButtons.forEach((id) => game.click(id, true));
    assert.deepEqual(game.snapshot(), result);
}

test("初期状態は1階層・スタミナ3・0pt・残り5ターン", () => {
    const game = createGame();
    assert.equal(game.read("floor_num"), "01");
    assert.equal(game.read("points_num"), "0000");
    assert.equal(game.read("head_line_inner-text"), "5");
    assert.equal(game.read("result"), "古びた扉の向こうに、ふたつの道がある。<br>さあ、どちらの道へ進もうか。");
    assert.deepEqual(game.hearts(), Array(3).fill("./img/svg/heart.svg"));
    assert.equal(game.screenState().endingType, null);
    [...explorationButtons, "button_reset"].forEach((id) => assert.equal(game.disabled(id), false));
});

for (const [direction, rates, totals, rewards] of [
    ["left", [80, 75, 70, 65, 60], [10, 30, 60, 100, 150], [10, 20, 30, 40, 50]],
    ["right", [50, 30, 10, 5, 2], [20, 60, 120, 240, 480], [20, 40, 60, 120, 240]]
]) {
    test(direction + ": 成功率ちょうどの乱数は成功し、第5階層の報酬を加算して第6階層でクリア", () => {
        const game = createGame();
        rates.forEach((rate, turn) => {
            game.choose(direction, rate);
            assert.equal(game.read("points_num"), String(totals[turn]).padStart(4, "0"));
            assert.equal(game.read("floor_num"), String([2, 3, 4, 5, 6][turn]).padStart(2, "0"));
            assert.equal(game.read("head_line_inner-text"), String(4 - turn));
            assert.equal(game.disabled("button_left"), turn === 4);
        });
        assert.match(game.read("result"), /ゲームクリア！5階層を制覇/);
        assert.equal(game.screenState().endingType, "cleared");
        assert.equal(game.screenState().floorCount, 6);
        assert.match(game.read("result"), /天空の庭園/);
        assert.doesNotMatch(game.read("result"), /探索が終了/);
        assertFinished(game);
    });

    test(direction + ": 各階層で成功率より1大きい乱数は失敗し、階層と点数を維持", () => {
        rates.forEach((rate, index) => {
            const game = createGame();
            for (let i = 0; i < index; i += 1) {
                game.choose(direction);
            }
            const previousPoints = game.read("points_num");
            assert.equal(game.read("choise_" + direction + "_probability"), String(rate));
            assert.equal(game.read("choise_" + direction + "_points"), String(rewards[index]));
            game.choose(direction, rate + 1);
            assert.equal(game.read("floor_num"), String(index + 1).padStart(2, "0"));
            assert.equal(game.read("points_num"), previousPoints);
            assert.deepEqual(game.hearts(), ["./img/svg/heart.svg", "./img/svg/heart.svg", "./img/svg/heart_none.svg"]);
            assert.equal(game.read("head_line_inner-text"), String(4 - index));
        });
    });
}

test("左右を切り替えた場合も現在の階層のポイントが加算される", () => {
    const game = createGame();
    game.choose("left");
    game.choose("right");
    assert.equal(game.read("floor_num"), "03");
    assert.equal(game.read("points_num"), "0050");
    assert.equal(game.read("choise_left_probability"), "70");
    assert.equal(game.read("choise_right_probability"), "10");
    assert.equal(game.read("choise_left_points"), "30");
    assert.equal(game.read("choise_right_points"), "60");
});

test("スタミナ切れで獲得済みポイントをすべて没収して終了", () => {
    const game = createGame();
    game.choose("right");
    [1, 2, 3].forEach(() => game.choose("left", 100));
    assert.equal(game.read("points_num"), "0000");
    assert.equal(game.read("floor_num"), "02");
    assert.equal(game.read("head_line_inner-text"), "1");
    assert.deepEqual(game.hearts(), Array(3).fill("./img/svg/heart_none.svg"));
    assert.match(game.read("result"), /ゲームオーバー/);
    assert.equal(game.screenState().endingType, "dead");
    assertFinished(game);
});

test("5ターン目にスタミナが尽きた場合もゲームオーバーとポイント没収が優先される", () => {
    const game = createGame();
    [1, 1, 100, 100, 100].forEach((roll) => game.choose("left", roll));
    assert.equal(game.read("points_num"), "0000");
    assert.equal(game.read("head_line_inner-text"), "0");
    assert.match(game.read("result"), /ゲームオーバー/);
    assert.doesNotMatch(game.read("result"), /探索が終了/);
    assertFinished(game);
});

test("5階層目で失敗してターン切れになった場合はクリア扱いにせずポイントを維持", () => {
    const game = createGame();
    [1, 1, 1, 1, 100].forEach((roll) => game.choose("left", roll));
    assert.equal(game.read("floor_num"), "05");
    assert.equal(game.read("points_num"), "0100");
    assert.match(game.read("result"), /5ターンの探索が終了/);
    assert.equal(game.screenState().endingType, "exhausted");
    assert.doesNotMatch(game.read("result"), /ゲームクリア/);
    assertFinished(game);
});

test("5ターン目に途中の階層で成功しても、最終階層を探索していなければターン切れ", () => {
    const game = createGame();
    [100, 1, 1, 1, 1].forEach((roll) => game.choose("left", roll));
    assert.equal(game.read("floor_num"), "05");
    assert.equal(game.read("points_num"), "0100");
    assert.match(game.read("result"), /5ターンの探索が終了/);
    assert.doesNotMatch(game.read("result"), /ゲームクリア/);
    assertFinished(game);
});

test("途中で帰還すると残りターン・スタミナ・ポイントを維持したまま探索を終了", () => {
    const game = createGame();
    game.choose("left");
    game.choose("right", 100);
    const hearts = game.hearts();
    game.click("button_back");
    assert.equal(game.read("floor_num"), "02");
    assert.equal(game.read("points_num"), "0010");
    assert.equal(game.read("head_line_inner-text"), "3");
    assert.deepEqual(game.hearts(), hearts);
    assert.match(game.read("result"), /到達階層は2階層.*持ち帰った点数は10pt/);
    assert.equal(game.screenState().endingType, "escaped");
    assertFinished(game);
});

test("開始直後でも0ptで帰還できる", () => {
    const game = createGame();
    game.click("button_back");
    assert.equal(game.read("head_line_inner-text"), "5");
    assert.match(game.read("result"), /到達階層は1階層.*持ち帰った点数は0pt/);
    assertFinished(game);
});

for (const [name, prepare] of [
    ["探索中", (game) => { game.choose("right"); game.choose("left", 100); }],
    ["クリア後", (game) => { [1, 1, 1, 1, 1].forEach((roll) => game.choose("left", roll)); }],
    ["ゲームオーバー後", (game) => { [1, 100, 100, 100].forEach((roll) => game.choose("right", roll)); }],
    ["ターン切れ後", (game) => { [1, 1, 1, 1, 100].forEach((roll) => game.choose("left", roll)); }],
    ["帰還後", (game) => { game.choose("right"); game.click("button_back"); }]
]) {
    test(name + "も、やり直すとすべての表示とボタンが初期状態に戻り再プレイできる", () => {
        const game = createGame();
        const initial = game.snapshot();
        prepare(game);
        game.click("button_reset");
        assert.deepEqual(game.snapshot(), initial);
        assert.deepEqual(game.screenState(), {
            floorCount: 1, lifeCount: 3, points: 0, gameCount: 0, isFinished: false, endingType: null
        });
        game.click("button_reset");
        assert.deepEqual(game.snapshot(), initial);
        game.choose("right");
        assert.equal(game.read("floor_num"), "02");
        assert.equal(game.read("points_num"), "0020");
        game.click("button_back");
        assert.match(game.read("result"), /持ち帰った点数は20pt/);
        assertFinished(game);
    });
}
