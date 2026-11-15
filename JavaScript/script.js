$(function () {
    console.log("読み込みOK");

    let gameCount = 0;
    let floorCount = 1;
    let lifeCount = 3;
    let points = 0;

    $("#button_left").on("click", function(){
        console.log("左ボタン");
        gameCount += 1;

        const successRate = 80 - (floorCount - 1) * 5;
        const num = Math.floor(Math.random() * 100) + 1;
        const successPoints = 10 + ((floorCount - 1) * 10);

        if (num <= successRate){
            // console.log("成功")
            floorCount += 1;
            points += successPoints;

            $("#result").html("お宝をゲット！"  + floorCount + "階層へ");

        } else if (num > successRate) {
            // console.log("失敗")
            lifeCount -= 1;

            $("#result").html("残念　もう一度"  + floorCount + "階層");

            if (lifeCount === 3){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart.svg"),
                $("#heart_03").attr("src", "./img/svg/heart.svg");
            } else if (lifeCount === 2){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            } else if (lifeCount === 1){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            } else {
                $("#heart_01").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_02").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            }
          
        }

        if (lifeCount <= 0) {
            points = 0;
            $("#result").text("体力がなくなった！獲得点数は0ptでした");
            $("#button_left, #button_right, #button_back").prop("disabled", true);
        } else if (gameCount >= 5) {
            $("#result").html("5ターンの探索が終了！<br>獲得点数は" + points + "ptでした");
            $("#button_left, #button_right, #button_back").prop("disabled", true);
        }

        $("#points_num").html(points);
        $("#floor_num").html(floorCount);
        $("#head_line_inner-text").html("残りターン：" + (5 - gameCount));

        // 左の道の表示
        $("#choise_left_probability").text("成功率" + (80 - (floorCount - 1) * 5) + "%");
        $("#choise_left_points").text("獲得ポイント" + (floorCount * 10) + "pt");

        // 右の道の表示
        $("#choise_right_probability").text("成功率" + (60 - (floorCount - 1) * 10) + "%");
        $("#choise_right_points").text("獲得ポイント" + (floorCount * 20) + "pt");

    });

    $("#button_right").on("click", function(){
        console.log("右ボタン");
        gameCount += 1;

        const successRate = 60 - (floorCount - 1) * 10;
        const num = Math.floor(Math.random() * 100) + 1;
        const successPoints = 20 + ((floorCount - 1) * 20);

        if (num <= successRate){
            // console.log("失敗")
            floorCount += 1;
            points += successPoints;

            $("#result").html("お宝をゲット！"  + floorCount + "階層へ");

        } else if (num > successRate) {
            // console.log("失敗")
            lifeCount -= 1;

            $("#result").html("残念　もう一度"  + floorCount + "階層") ; 
             
            if (lifeCount === 3){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart.svg"),
                $("#heart_03").attr("src", "./img/svg/heart.svg");
            } else if (lifeCount === 2){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            } else if (lifeCount === 1){
                $("#heart_01").attr("src", "./img/svg/heart.svg"),
                $("#heart_02").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            } else {
                $("#heart_01").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_02").attr("src", "./img/svg/heart_none.svg"),
                $("#heart_03").attr("src", "./img/svg/heart_none.svg");
            }

        }

        if (lifeCount <= 0) {
            points = 0;
            $("#result").text("体力がなくなった！獲得点数は0ptでした");
            $("#button_left, #button_right, #button_back").prop("disabled", true);
        } else if (gameCount >= 5) {
            $("#result").html("5ターンの探索が終了！<br>獲得点数は" + points + "ptでした");
            $("#button_left, #button_right, #button_back").prop("disabled", true);
        }

        $("#points_num").html(points);
        $("#floor_num").html(floorCount);
        $("#head_line_inner-text").html("残りターン：" + (5 - gameCount));

        // 左の道の表示
        $("#choise_left_probability").text("成功率" + (80 - (floorCount - 1) * 5) + "%");
        $("#choise_left_points").text("獲得ポイント" + (floorCount * 10) + "pt");

        // 右の道の表示
        $("#choise_right_probability").text("成功率" + (60 - (floorCount - 1) * 10) + "%");
        $("#choise_right_points").text("獲得ポイント" + (floorCount * 20) + "pt");

    });

    $("#button_back").on("click", function(){
        $("#result").html("おつかれさまでした。今回の成果は<br>" + floorCount + "階層まで制覇　最終点数は" + points + "でした");
    });

    if (gameCount >= 5){
        $("#result").html("5ターンの探索が終了！<br>獲得点数は" + points + "でした");
        $("#button_left, #button_right").prop("disabled", true);
    }

    $("#button_reset").on("click", function(){
        gameCount = 0;
        floorCount = 1;
        lifeCount = 3;
        points = 0;
        $("#button_left, #button_right").prop("disabled", false);
    });

});