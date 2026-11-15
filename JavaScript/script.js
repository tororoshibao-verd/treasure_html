// HTMLの読み込みが終わってから、ゲームの準備とボタンの設定を行う。
$(function () {
    // constは途中で変えない設定値。ゲームの上限をここにまとめる。
    const MAX_TURNS = 5;
    const MAX_FLOOR = 5;
    const MAX_LIFE = 3;
    const INITIAL_MESSAGE = "結果：ここに結果が表示されます";

    // letはプレイ中に変わるデータ。画面はこれらの値をもとに更新する。
    let gameCount = 0;                       // 道を選んだ回数（成功・失敗の両方を数える）
    let floorCount = 1;                      // 現在挑戦している階層
    let lifeCount = MAX_LIFE;                // 残りスタミナ
    let points = 0;                          // 今回の探索で集めたポイント
    let isFinished = false;                 // false：探索中、true：終了済み
    let resultMessage = INITIAL_MESSAGE;    // 結果欄に表示する文章

    // directionには"left"か"right"が入る。
    // 現在の階層に応じた成功率と獲得ポイントを、1つのオブジェクトにして返す。
    // 抽選と画面表示の両方で使い、表示と実際の判定が食い違わないようにする。
    function getRoadInfo(direction) {
        if (direction === "left") {
            return {
                successRate: 80 - (floorCount - 1) * 5,
                successPoints: floorCount * 10
            };
        }

        return {
            successRate: 60 - (floorCount - 1) * 10,
            successPoints: floorCount * 20
        };
    }

    // 変数の値を変えただけではHTMLは変わらないため、この関数で画面に反映する。
    // 探索後もやり直し時も同じ関数を呼び、更新し忘れる項目が出ないようにする。
    function updateDisplay() {
        $("#points_num").text(points);
        $("#floor_num").text(floorCount);
        $("#head_line_inner-text").text("残りターン：" + (MAX_TURNS - gameCount));
        $("#result").html(resultMessage); // 結果の文章には改行用の<br>があるためhtml()を使う。

        // ハートを1個目から順に確認し、残りスタミナ分だけ色付き画像にする。
        for (let i = 1; i <= MAX_LIFE; i += 1) {
            // 条件 ? A : B は、条件がtrueならA、falseならBを選ぶ書き方。
            const heartImage = i <= lifeCount ? "heart.svg" : "heart_none.svg";
            $("#heart_0" + i).attr("src", "./img/svg/" + heartImage);
        }

        // forEachで左・右の順に同じ表示更新を行う。
        ["left", "right"].forEach(function (direction) {
            const road = getRoadInfo(direction);
            $("#choise_" + direction + "_probability").text("成功率" + road.successRate + "%");
            $("#choise_" + direction + "_points").text("獲得ポイント" + road.successPoints + "pt");
        });

        // disabledがtrueなら操作不可、falseなら操作可能。やり直すボタンは常に使える。
        $("#button_left, #button_right, #button_back").prop("disabled", isFinished);
    }

    // 左右どちらのボタンからも呼ばれる、1ターン分の探索処理。
    function explore(direction) {
        // 終了後は、追加のイベントが発生しても点数や階層を変えない。
        if (isFinished) {
            return;
        }

        const road = getRoadInfo(direction);
        // 1〜100の整数を抽選する。例：成功率80%なら、1〜80が出たときに成功。
        const num = Math.floor(Math.random() * 100) + 1;
        // 成功・失敗にかかわらず、道を選んだ時点で1ターン消費する。
        gameCount += 1;

        if (num <= road.successRate) {
            // 次の階層に進む前に、現在挑戦した階層のポイントを加算する。
            points += road.successPoints;

            // 5階層目の探索に成功したら、6階層へ進まずにクリアする。
            if (floorCount === MAX_FLOOR) {
                isFinished = true;
                resultMessage = "ゲームクリア！" + MAX_FLOOR + "階層を制覇！<br>獲得点数は" + points + "ptでした";
            } else {
                floorCount += 1;
                resultMessage = "お宝をゲット！" + floorCount + "階層へ";
            }
        } else {
            // 失敗時は同じ階層に留まり、スタミナだけ減らす。
            lifeCount -= 1;
            resultMessage = "残念！スタミナが1減りました。もう一度" + floorCount + "階層に挑戦";
        }

        // 最終ターンでも、スタミナ切れならポイントを没収する。
        if (lifeCount <= 0) {
            points = 0;
            isFinished = true;
            resultMessage = "ゲームオーバー！体力がなくなった！<br>獲得点数は0ptでした";
        } else if (!isFinished && gameCount >= MAX_TURNS) {
            // !isFinishedは「まだ終了していない」。最終ターンのクリア表示を上書きしない。
            isFinished = true;
            resultMessage = MAX_TURNS + "ターンの探索が終了！<br>獲得点数は" + points + "ptでした";
        }

        // このターンで変わったデータと、操作できるボタンを画面に反映する。
        updateDisplay();
    }

    // ボタン側は選んだ方向を渡すだけにし、探索の処理を左右で共通化する。
    $("#button_left").on("click", function () {
        explore("left");
    });

    $("#button_right").on("click", function () {
        explore("right");
    });

    // 帰還はターンを消費せず、その時点のポイントを保持して探索を終える。
    $("#button_back").on("click", function () {
        if (isFinished) {
            return;
        }

        isFinished = true;
        resultMessage = "入り口へ戻りました。到達階層は" + floorCount + "階層<br>持ち帰った点数は" + points + "ptでした";
        updateDisplay();
    });

    // 探索中・終了後のどちらでも、すべてのデータを初期状態に戻す。
    $("#button_reset").on("click", function () {
        gameCount = 0;
        floorCount = 1;
        lifeCount = MAX_LIFE;
        points = 0;
        isFinished = false;
        resultMessage = INITIAL_MESSAGE;
        // ハート・点数などを戻すと同時に、探索と帰還のボタンを再び使えるようにする。
        updateDisplay();
    });

    // ページを開いたときにも、初期データと画面の表示を一致させる。
    updateDisplay();
});
