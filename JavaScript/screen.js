// 見た目・効果音・キーボード操作を担当する。
// 確率や得点の計算はscript.jsに任せ、ゲームのルールを二重に書かない。
(function () {
    const getElement = function (id) {
        return document.getElementById(id);
    };
    const locationNames = [
        "忘却の回廊", "	古王の石室", "王家の祭壇", "黄金の大広間", "黄金の間", "天空の庭園"
    ];
    const endingMessages = {
        cleared: ["GAME CLEAR", "深淵の宝を、その手に。"],
        dead: ["GAME OVER", "冒険者は、闇に飲まれた。"],
        escaped: ["WELCOME HOME", "お宝とともに、無事に帰還。"],
        exhausted: ["EXPLORATION END", "松明が消える前に、帰ろう。"]
    };
    const floorBackgroundFiles = [
        "./img/dungeon.png",
        "./img/dungeon-floor-2.png",
        "./img/dungeon-floor-3.png",
        "./img/dungeon-floor-4.png",
        "./img/dungeon-floor-5.png",
        "./img/dungeon-floor-6.png"
    ];
    // 次の階層の画像を先に読み込み、画像が表示されるまでの待ち時間を減らす。
    const floorBackgroundImages = floorBackgroundFiles.map(function (file) {
        const image = new Image();
        image.src = file;
        return image;
    });
    let selectedDirection = "left";
    let previousState = null;
    let soundEnabled = false;
    let audioContext;
    let isChangingFloor = false;
    let backgroundChangeId = 0;

    function wait(milliseconds) {
        return new Promise(function (resolve) {
            setTimeout(resolve, milliseconds);
        });
    }

    function setExplorationDisabled(disabled) {
        ["button_left", "button_right", "button_back"].forEach(function (id) {
            getElement(id).disabled = disabled;
        });
    }

    // 完全に暗くなったところで画像を差し替え、少し待ってから明るさを戻す。
    async function changeFloorBackground(floorCount, useBlackout) {
        const changeId = ++backgroundChangeId;
        const scene = getElement("dungeon-scene");
        const image = getElement("dungeon-art");
        const blackout = getElement("scene-blackout");
        const background = floorBackgroundImages[floorCount - 1];
        const imageDescription = "第" + floorCount + "階層 " + locationNames[floorCount - 1].trim() + "の背景";
        scene.classList.remove("scene-flash");

        if (!useBlackout) {
            image.src = background.src;
            image.alt = imageDescription;
            return;
        }

        isChangingFloor = true;
        setExplorationDisabled(true);
        blackout.classList.add("is-dark");
        await Promise.all([
            wait(160),
            background.decode().catch(function () {
                // 読み込みに失敗した場合も、暗転を解除できるようにする。
            })
        ]);
        // やり直しなどで新しい切り替えが始まっていたら、古い処理を終える。
        if (changeId !== backgroundChangeId) {
            return;
        }

        image.src = background.src;
        image.alt = imageDescription;
        await wait(120);
        if (changeId !== backgroundChangeId) {
            return;
        }

        // 到達した背景と一緒に終了メッセージを見せる。
        getElement("ending-banner").hidden = !previousState.isFinished;
        blackout.classList.remove("is-dark");
        await wait(160);
        if (changeId !== backgroundChangeId) {
            return;
        }

        isChangingFloor = false;
        setExplorationDisabled(previousState.isFinished);
    }

    // 効果音は、ユーザーが「音 ON」を選んだ後だけ鳴らす。
    // 音源ファイルを使わず、Web Audio APIで短いレトロな音を作る。
    function playTone(kind) {
        if (!soundEnabled) {
            return;
        }
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = audioContext || new AudioContextClass();
            if (audioContext.state === "suspended") {
                audioContext.resume();
            }
            const sounds = {
                success: [392, 523, 659],
                fail: [196, 147],
                clear: [392, 523, 659, 784],
                back: [294, 392]
            };
            sounds[kind].forEach(function (frequency, index) {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const start = audioContext.currentTime + index * 0.09;
                oscillator.type = "triangle";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0.035, start);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.start(start);
                oscillator.stop(start + 0.17);
            });
        } catch (error) {
            // 音声機能を使えないブラウザでも、ゲームはそのまま続けられる。
            soundEnabled = false;
            getElement("sound-toggle").setAttribute("aria-pressed", "false");
            getElement("sound-label").textContent = "音 OFF";
        }
    }

    function selectDirection(direction) {
        selectedDirection = direction;
        ["left", "right"].forEach(function (side) {
            getElement("button_" + side).classList.toggle("is-selected", side === direction);
        });
    }

    // script.jsから受け取った状態で、背景上の現在地や終了演出を更新する。
    function updateScreen(state) {
        const scene = getElement("dungeon-scene");
        const floorChanged = !previousState || state.floorCount !== previousState.floorCount;
        if (floorChanged) {
            changeFloorBackground(state.floorCount, previousState !== null);
        }
        getElement("hearts").setAttribute("aria-label", "スタミナ" + state.lifeCount + " / 3");
        getElement("location-text").textContent = "第" + state.floorCount + "階層 ― " + locationNames[state.floorCount - 1];
        scene.setAttribute("aria-label", "第" + state.floorCount + "階層 " + locationNames[state.floorCount - 1].trim() + "の風景");
        getElement("turn-pips").querySelectorAll("i").forEach(function (pip, index) {
            pip.classList.toggle("spent", index >= 5 - state.gameCount);
        });
        getElement("floor-map").querySelectorAll("li").forEach(function (floor, index) {
            const isCurrent = index + 1 === state.floorCount;
            floor.classList.toggle("current", isCurrent && !state.isFinished);
            floor.classList.toggle("visited", index + 1 < state.floorCount || state.endingType === "cleared");
            floor.setAttribute("aria-label", (index + 1) + "階層" + (isCurrent ? " 現在地" : ""));
        });

        getElement("route-choices").hidden = state.endingType === "cleared";
        getElement("ending-banner").hidden = !state.isFinished || isChangingFloor;
        if (state.endingType) {
            scene.dataset.ending = state.endingType;
            getElement("ending-title").textContent = endingMessages[state.endingType][0];
            getElement("ending-subtitle").textContent = endingMessages[state.endingType][1];
        } else {
            delete scene.dataset.ending;
        }

        if (previousState && state.gameCount > previousState.gameCount) {
            // 前回からターンが増えたときだけ、成功・失敗に応じた演出を行う。
            playTone(state.endingType === "cleared" ? "clear" : state.lifeCount < previousState.lifeCount ? "fail" : "success");
            if (!floorChanged && !isChangingFloor) {
                scene.classList.remove("scene-flash");
                // 一度レイアウトを読み取り、連続クリックでもアニメーションを再開する。
                void scene.offsetWidth;
                scene.classList.add("scene-flash");
            }
        } else if (state.endingType === "escaped" && previousState && !previousState.isFinished) {
            playTone("back");
        }

        if (!previousState || state.gameCount < previousState.gameCount || (previousState.isFinished && !state.isFinished)) {
            selectDirection("left");
            scene.classList.remove("scene-flash");
        }
        previousState = { ...state };
        // 暗転中にやり直した場合も、次の背景が見えるまで移動操作を待つ。
        if (isChangingFloor) {
            setExplorationDisabled(true);
        }
    }

    ["left", "right"].forEach(function (direction) {
        const button = getElement("button_" + direction);
        button.addEventListener("mouseenter", function () {
            if (!button.disabled) {
                selectDirection(direction);
            }
        });
        button.addEventListener("focus", function () {
            selectDirection(direction);
        });
    });

    getElement("sound-toggle").addEventListener("click", function () {
        soundEnabled = !soundEnabled;
        getElement("sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
        getElement("sound-label").textContent = soundEnabled ? "音 ON" : "音 OFF";
        if (soundEnabled) {
            playTone("back");
        }
    });

    // 遊び方はネイティブのdialogを使うため、Escで閉じる操作にも対応する。
    const helpDialog = getElement("help-dialog");
    getElement("help-open").addEventListener("click", function () {
        helpDialog.showModal();
    });
    getElement("help-close").addEventListener("click", function () {
        helpDialog.close();
    });
    helpDialog.addEventListener("click", function (event) {
        if (event.target !== helpDialog) {
            return;
        }
        const bounds = helpDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            helpDialog.close();
        }
    });

    // キーボードでも既存のボタンを押す。終了後の判定はscript.jsが担当する。
    document.addEventListener("keydown", function (event) {
        if (helpDialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            if (previousState && !previousState.isFinished) {
                event.preventDefault();
                selectDirection(event.key === "ArrowLeft" ? "left" : "right");
                getElement("button_" + selectedDirection).focus({ preventScroll: true });
            }
        } else if (event.key === "Enter" && ["BODY", "MAIN"].includes(document.activeElement.tagName)) {
            event.preventDefault();
            getElement("button_" + selectedDirection).click();
        } else if (event.key === "Escape") {
            event.preventDefault();
            getElement("button_back").click();
        } else if (event.key.toLowerCase() === "r") {
            event.preventDefault();
            getElement("button_reset").click();
        }
    });

    window.gameScreen = { update: updateScreen };
})();
