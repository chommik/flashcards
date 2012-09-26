Flashcards = {
    
    togglePage: function(event) {
        var newpage = window.location.hash.slice(1);
        if (newpage == "") newpage = "main";
        $(".nav a").parent().removeClass("active");
        $(".nav a[href=#" + newpage + "]").parent().addClass("active");
        
        $(".page").removeClass("active");
        $("#page-" + newpage).addClass("active");
    },
    submitAnswer: function() {
        if (Flashcards.config.get("enableAnim"))
        {
            $('.card').addClass("hidden");
        }
        
        var submitted = $(".card input").val();
        var current = State.currentList.shift().slice();
        if (current == undefined) {
            Flashcards.endTraining();
            return;
        }
        
        console.log("submitted: '" + submitted + "'; current: '" + current + "'");
        
        if (!Flashcards.checkAnswer(submitted, current[1])) {
            
            if (!Flashcards.config.get("quizMode")) {
                if (current[2] != undefined) {
                    current[2] = 0;
                }
                
                State.failedList.push(current);
            }
             
            State.statistics.wrong += 1;
            
            $('.card-remember .q').html(current[0]);
            $('.card-remember .a').html(current[1]);
            
            if (Flashcards.config.get("incorrectShow")) {
                $(".card-remember .e").html(submitted);
            }
            
            setTimeout(function() {
                $('.card-remember .q').html('');
                $('.card-remember .a').html('');
                $(".card-remember .e").html('');
                Flashcards.updateCard();
            }, Flashcards.config.get('rememberTime'));
            
            if (Flashcards.config.get("enableSound")) {
                $("#snd-err")[0].play();
            }
            
        } else {
            if (current[2] == undefined) {
                current[2] = 1;
            } else {
                current[2]++;
            }
            
            if (current[2] < Flashcards.config.get("repeatCount")) {
                State.wordList.push(current);
                State.wordList = shuffle(State.wordList);
            } else {
                State.doneWords += 1;
            }
            State.statistics.correct += 1;
            
            if (Flashcards.config.get("enableSound")) {
                $("#snd-ok")[0].play();
            }
        }
        
        State.currentList = shuffle(State.currentList);
        
        State.statistics.submitted += 1;
        
        if (State.currentList.length == 0) {
            if (State.wordList.length == 0 && State.failedList.length == 0) {
                Flashcards.updateCard();
                Flashcards.endTraining();
                return;
            }
            Flashcards.reflushCurrent();
        }
        
        if (Flashcards.config.get("enableAnim"))
        {
            setTimeout(function() {
                $(".card").removeClass('hidden');    
            }, 600);
        }
        Flashcards.updateCard();
        Flashcards.updateStats();
    },
    
    checkAnswer: function(a, b) {
          if (!Flashcards.config.get('matchCase')) {
              if (a.toLowerCase() == b.toLowerCase()) return true;
          }
          if (!Flashcards.config.get('matchPunctation'))
          {
              if (a.replace(/[^\w\s]/g, '') == b.replace(/[^\w\s]/g, '')) return true;
          }
          return a.trim() == b.trim();      
    },
    
    reflushCurrent: function() {
        State.wordList = shuffle(State.wordList);
        var wordsNumber = Flashcards.config.get('wordListChunk') - State.failedList.length;
        var wordsToAdd = State.wordList.slice(0,wordsNumber); 
        var newWords = shuffle(State.failedList.concat(wordsToAdd));
        State.wordList = State.wordList.splice(wordsToAdd.length);
        State.failedList = [];
        
        console.log("failedList = " + State.failedList);
        console.log("newWords = " + newWords);
        console.log("wordList = " + State.wordList);
        
        State.currentList = newWords;
    },
    
    updateCard: function() {
        var question = Flashcards.currentWord();
        $('.card .card-word').html(question);
        $('.card input').val('').trigger('update'); // We need to trigger 'update' event in order textbox to resize
        Flashcards.updateStats();
    },
    
    currentWord: function(e) {
        if (State.currentList[0] == undefined) {
            Flashcards.endTraining();
            return "ø";
        } else {
            return State.currentList[0][0]; 
        }
    },
    
    startTraining: function(e) {
        if (State.trainingRunning) return;
        if (State.wordset['words'] == undefined) {
            $.notifyBar({
                   html: "Najpierw należy załadować słowa. (zakładka Lista słów)",
                   delay: 1500,
                   cls: "error"
            });
            e.preventDefault();
            return;
        }
        State.trainingRunning = true;
        State.statistics = { submitted: 0, wrong: 0, correct: 0 };
        
        State.wordList = [];
        
        for (i in State.wordset.words) {
            State.wordList.push(State.wordset.words[i].slice());
        } // I used .slice() because of some weird assignment by reference. JavaScript usually assigns by value.
         
        State.totalWords = State.wordset.words.length * Flashcards.config.get("repeatCount");
        State.doneWords = 0;
        
        Flashcards.updateStats();
        Flashcards.reflushCurrent();
        Flashcards.updateCard();
        $(".card").removeClass("hidden");
        
        $('#btn-start').attr('disabled', true);
        $('#btn-stop').attr('disabled', false);
        
        $(".card input").focus();
    },
    
    endTraining: function() {
        if (State.trainingRunning) {
            State.trainingRunning = false;
            $(".card").addClass("hidden");
            $("#successModal").modal('show');
            
            $('#btn-start').attr('disabled', false);
            $('#btn-stop').attr('disabled', true);    
        }
    },
    
    importList: function() {
        var text = $("#import-modal textarea").val().trim();
        
        if (text[0] != "{") {
            var decoded = b64_decode(text.trim().replace(/\n/g,""));
            if (decoded[0] == "{") {
                text = decoded;
            } else {
                $.notifyBar({
                    html: "Błędna paczka.",
                    cls: "error",
                    delay: 1500
                });
                
                return;                
            }
        }
        
        newList = JSON.parse(text);
        State.wordset = newList;
        $.notifyBar({
               html: "Załadowano nowe słowa.",
               delay: 1500
        });
        Flashcards.refreshWordList();
        $("#import-modal").modal('hide');
    },
    
    addWord: function() {
        var question = $("#wordlist-question").val().trim();
        var answer = $("#wordlist-answer").val().trim();
        
        if (State.wordset.words == undefined) {
            State.wordset.words = [];    
        }
        State.wordset.words.push([question, answer]);
        Flashcards.appendWordlistTable(State.wordset.words.length - 1, question, answer)
    },
    
    exportList: function() {
        $("#export-modal textarea").val(JSON.stringify(State.wordset));
        $("#export-modal .tobase64").attr('disabled', false);
    },
    
    refreshWordList: function() {
        $("#wordlist table tbody tr").remove();
        for (i in State.wordset.words) {
            Flashcards.appendWordlistTable(i, State.wordset.words[i][0], State.wordset.words[i][1])
        }
    },
    
    appendWordlistTable: function(id, question, answer) {
        var tr = document.createElement("tr");
        var num = document.createElement("td");
        num.innerHTML = (parseInt(id) + 1).toString();
        
        var questionTd = document.createElement("td");
        questionTd.innerHTML = question;
        
        var answerTd = document.createElement("td");
        answerTd.innerHTML = answer;
        
        var removeTd = document.createElement("td");
        removeTd.innerHTML = "<a class=\"btn btn-mini wordlist-remove\" data-id=\"" + id + "\"><i class=\"icon-minus-sign\"></i>Usuń</a>";
        
        $(removeTd).click(function() {
            var arrayId = parseInt($(this).find("a").data('id'));
            delete State.wordset.words[arrayId];
            State.wordset.words = State.wordset.words.slice(); // Some dirty hacks
            State.wordset.words = State.wordset.words.filter(function(x){ return x != undefined});
                // Don't know why too. 
            Flashcards.refreshWordList();
        });
        
        tr.appendChild(num);
        tr.appendChild(questionTd);
        tr.appendChild(answerTd);
        tr.appendChild(removeTd);
        
        $("#wordlist table tbody").append(tr);
        $("#wordlist").scrollTop(99999999999);
    },
    
    updateStats: function() {
        var repRequired = Flashcards.config.get('repeatCount'); 
        
        var currentRepeats = 0;
        var listRepeats = 0;
        
        for (i in State.currentList) {
            var repeats = State.currentList[i][2];
            if (repeats == undefined) repeats = 0;
            currentRepeats += repeats;
        }
        
        for (i in State.wordList) {
            var repeats = State.wordList[i][2];
            if (repeats == undefined) repeats = 0;
            listRepeats += repeats;
        }
        
        var done = currentRepeats + listRepeats + (State.doneWords * repRequired);
        
        // {"words":[["a","aa"],["bb","bb"],["cc","cc"]]}
        
        var progress = ((done / State.totalWords) * 100);
        
        var correct = (State.statistics.correct / State.statistics.submitted) * 100;
        var wrong = (State.statistics.wrong / State.statistics.submitted) * 100;
        
        progress = Math.floor(progress * 100) / 100;
        correct = Math.floor(correct * 100) / 100;
        wrong = Math.floor(wrong * 100) / 100;
        
        document.querySelector("#control-progress .bar").style.width = !isNaN(progress) ? progress.toString() + "%" : "0%";
        document.querySelector("#control-correct .bar").style.width = !isNaN(correct) ? correct.toString() + "%" : "0%";
        document.querySelector("#control-wrong .bar").style.width = !isNaN(wrong) ? wrong.toString() + "%" : "0%";
        
        document.querySelector("#control-progress span").innerHTML = !isNaN(progress) ? progress.toString() : "--";
        document.querySelector("#control-correct span").innerHTML = !isNaN(correct) ? correct.toString() : "--";
        document.querySelector("#control-wrong span").innerHTML = !isNaN(wrong) ? wrong.toString() : "--"; 
    },
    
    init: function() {
        $(window).bind("hashchange", Flashcards.togglePage);
        $(window).trigger("hashchange");
        
        $(".modal").modal({show: false});
        
        $("#bg").fadeIn();
        $(".card-input input").autoGrowInput({
           comfortZone: 40,
           minWidth: 400,
           maxWidth: 800 
        });

        $(window).konami(function(){
            $("#debug-modal textarea").val(
                navigator.userAgent + "\n\n" +
                JSON.stringify(State) + "\n\n" +
                JSON.stringify(window.localStorage)
                );
            $("#debug-modal").modal({show: true});
        });
        $("#debug-clearconfig").click(function(){
            window.localStorage.clear();
            $(this).attr("disabled", true).html("Wyczyszczono. Odśwież stronę.");
        });
        
        $(".card-input input").keypress(function(event) {
            if (event.keyCode == 13) { // 13 - Enter
                Flashcards.submitAnswer();
            }
        });
        $("#wordlist-answer").keypress(function(event) {
            if (event.keyCode == 13) { // 13 - Enter
                Flashcards.addWord();
                $("#wordlist-question,#wordlist-answer").val('')
                $("#wordlist-question").focus();
            }
        });
        $("#wordlist-add").click(function(event) {
            Flashcards.addWord();
            $("#wordlist-question,#wordlist-answer").val('')
            $("#wordlist-question").focus();
        });
        $("#wordlist-question").keypress(function(event) {
            if (event.keyCode == 13) { // 13 - Enter
                $("#wordlist-answer").focus(); 
            }
        });
        
        $(".nav a").click(function(e) {
           if (State.trainingRunning) {
               $.notifyBar({
                   html: "Nie można zmienić zakładki w trakcie trwania ćwiczenia.",
                   delay: 1500,
                   cls: "error"
               });
               e.preventDefault();
           }
        });
        
        $("#wordlist-import").click(function() {
            $('#import-modal').modal("show"); 
            $("#import-modal textarea").focus();
        });
        $("#btn-import").click(Flashcards.importList);
        $("#wordlist-export").click(function() {
            Flashcards.exportList();
            $('#export-modal').modal("show"); 
        });
        $(".wordlist-remove").click(function() {
            id = parseInt($(this).find('a').data('id'));
            console.log(this);
            delete State.wordset.words[id];
            State.wordset.words = State.wordset.words.slice(); // Some dirty hacks
            State.wordset.words = State.wordset.words.filter(function(x){ return x != undefined});
                // Don't know why too. 
            Flashcards.refreshWordList();
        });
        
        $("#export-modal .selectall").click(function(e) {
           $("#export-modal textarea").select();
        });
        
        $("#export-modal .tobase64").click(function(e) {
           if ($(this).attr("disabled") != "disabled") {
               var current = $("#export-modal textarea").val();
               $("#export-modal textarea").val(b64_encode(current));
               $(this).attr("disabled", true);
           }
        });
        
        $("input[data-var]").each(function(i, item) {
            if ($(this).attr('type') == 'checkbox') {
                $(item).attr('checked', Flashcards.config.get( $(item).data('var')) == "1" ); 
            } else {
                $(item).val( Flashcards.config.get( $(item).data('var')) );    
            }
             
        });
        
        $("#page-config input[data-var]").change(function(e) {
            if ($(this).data('var') == "wallpaper") { 
                Flashcards.setWallpaper("url(\""+$(this).val()+"\")");
                return;
            }
            
            var value = $(this).val();
            if ($(this).attr('type') == 'checkbox') {
                value = $(this).attr('checked') ? 1 : 0;
            }
            console.log(value);
            console.log($(this).data('var'));
            Flashcards.config.set($(this).data('var'), value);
        });
        
        $(".wordlist-setting").change(function(e) {
            var value = $(this).val();
            if ($(this).attr('type') == 'checkbox') {
                value = $(this).attr('checked') ? 1 : 0;
            }
            console.log(value);
            console.log($(this).data('var'));
            State.wordset[$(this).data('var')] = value;
        });
        
        $("#bg").css('background-image', 'url(' + Flashcards.config.get('wallpaper') + ')');
        
        $(".card-buttons .submit").click(Flashcards.submitAnswer);
        $("#btn-start").click(Flashcards.startTraining);
        $("#btn-stop").click(Flashcards.endTraining);
        
    },
    
    setWallpaper: function(id) {
        var url = '';
        switch (id)
        {
            case 1: url = '/img/wallp/1.jpg'; break;
            case 2: url = '/img/wallp/2.jpg'; break;
            case 3: url = '/img/wallp/3.jpg'; break;
            case 4: url = '/img/wallp/4.jpg'; break;
            case 5: url = '/img/wallp/5.jpg'; break;
            case 6: url = '/img/wallp/6.jpg'; break;
            case 7: url = 'http:​/​/​static-eu.chommik.net.pl/​images/​start-img/​11/​12.jpg'; break;
            default: url = id;
        };
        Flashcards.config.set('wallpaper', url);
        $("#bg").fadeOut('slow');
        $("#bg").css('background-image', 'url(' + url + ')');
        $("#bg").fadeIn('slow');
        $("#input06").val(url);
    },
    
    config: {
        get: function(item) {
            if (item in localStorage) {
                if (!isNaN(parseFloat(localStorage[item])))
                    return parseFloat(localStorage[item]);
                else
                    return localStorage[item];
            } else if (item in DefaultConfig) {
                return DefaultConfig[item];
            } else {
                return undefined;
            }
        },
        set: function(item, value) {
            localStorage[item] = value;
        },
        reset: function(item) {
            if (item in DefaultConfig) {
                localStorage[item] = DefaultConfig[item];
            } else {
                localStorage.removeItem(item);
            }
        }
    }
};

DefaultConfig =  {
    replayFailedWords: 1,
    rememberTime: 3000,
    wordListChunk: 20,
    quizMode: 0,
    cardAnimTime: 250,
    enableAnim: 1,
    matchCase: 0,
    matchPunctation: 1,
    repeatCount: 1,
    enableSound: 1,
    wallpaper: "http://static-eu.chommik.net.pl/images/start-img/07/15.jpg"
};

State = {
    trainingRunning: false,
    
    wordList: [],
    currentList: [],
    failedList: [], 
    totalWords: 0,
    doneWords: 0,
    curentWord: undefined,
    incorrectShow: false,
    
    wordset: { },
    
    statistics: {
        submitted: 0,
        wrong: 0,
        correct: 0
    }
};

Whoami = {
    webkit: window.navigator.userAgent.search("AppleWebKit"),
    firefox: window.navigator.userAgent.search("Firefox")
}

$(function() {
    Flashcards.init();
});
