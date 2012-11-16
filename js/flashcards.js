Flashcards = {
    
    togglePage: function(event) {
        var newpage = window.location.hash.slice(1);
        if (newpage == "") newpage = "main";
        $(".nav a").parent().removeClass("active");
        $(".nav a[href=#" + newpage + "]").parent().addClass("active");
        
        $(".page").removeClass("active");
        $("#page-" + newpage).addClass("active");
        
        Achievements.signal('pageToggle', newpage);
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
            Achievements.signal('finish');
            return;
        }
        
        //console.log("submitted: '" + submitted + "'; current: '" + current + "'");
        
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
            
            if (State.lastTimeout != 0) clearTimeout(State.lastTimeout);
            State.lastTimeout = setTimeout(function() {
                $('.card-remember .q').html('');
                $('.card-remember .a').html('');
                $(".card-remember .e").html('');
            }, Flashcards.config.get('rememberTime'));
            
            if (Flashcards.config.get("enableSound")) {
                $("#snd-err")[0].play();
            }
            
            Achievements.signal('wrong');
            
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
            
            Achievements.signal('correct');
        }
        
        State.currentList = shuffle(State.currentList);
        
        State.statistics.submitted += 1;
        
        if (State.currentList.length == 0) {
            if (State.wordList.length == 0 && State.failedList.length == 0) {
                Flashcards.updateCard();
                Flashcards.endTraining();
                Achievements.signal('finish');
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
        
        Achievements.signal('answer', submitted);
        
        Flashcards.updateCard();
        Flashcards.updateStats();
    },
    
    checkAnswer: function(a, b) { // a: answer, b: question
          if (State.wordset.regexp == 1) {
              var flags = Flashcards.config.get('matchCase') ? "i" : "";
              // Przerobienie "uproszczonej" formy regexpa na prawidłową
              var chunks = b.split('/');
              for (i in chunks)
              {
                  chunks[i] = chunks[i].replace(/\((.+)\) (.+)/, '($1 |)$2');
              }
              if (chunks.length > 1)
              {
                  var str = "^((" + chunks.join('|') + ")(\/|)){" + chunks.length + "}$";
              } else {
                  var str = "^" + chunks[0] + "$";
              }
              var regexp = RegExp(str, flags);
              return a.match(regexp) != null;
          }
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
        
        State.statistics.startTime = Math.floor(Date.now()/1000);
        
        Achievements.signal('start');
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
        var newList = false;
        
        $("#loading").show();
        $("#import-modal").modal('hide');
        
        try {
            if (text[0] != "{") {
                var tempList = text.split('\n');
                var temp2List = []
                for (i in tempList) {
                    var word = tempList[i].split(';')
                    if (word.length != 2) throw false;
                    temp2List.push(word);
                }
                newList = { words: temp2List };
            } 
            else {
                newList = JSON.parse(text);
            }
        } catch(err) { var newList = false; }
        
        if (!newList) {        
            $.notifyBar({
                html: "Błędna paczka.",
                cls: "error",
                delay: 1500
            });
            
        } else {
            State.wordset = newList;
            Flashcards.refreshWordList();
            
            $.notifyBar({
                   html: "Załadowano nowe słowa.",
                   delay: 1500
            });
            Achievements.signal('importList');
        }
        $("#loading").hide();
    },
    
    addWord: function() {
        var question = $("#wordlist-question").val().trim();
        var answer = $("#wordlist-answer").val().trim();
        
        if (State.wordset.words == undefined) {
            State.wordset.words = [];    
        }
        State.wordset.words.push([question, answer]);
        Flashcards.appendWordlistTable(State.wordset.words.length - 1, question, answer);
        
        Achievements.signal('addWord');
        $("#wordlist").scrollTop(99999999999);
    },
    
    exportList: function() {
        $("#export-modal textarea").val(JSON.stringify(State.wordset));
        $("#export-modal .tobase64").attr('disabled', false);
        
        Achievements.signal('exportList');
    },
    
    refreshWordList: function() {
        $("#loading").show();
        $("#wordlist").hide();
        $("#wordlist table tbody tr").remove();
        for (i in State.wordset.words) {
            Flashcards.appendWordlistTable(i, State.wordset.words[i][0], State.wordset.words[i][1])
        }
        $("#wordlist").show();
        $("#loading").fadeOut('fast');
    },
    
    refreshMetadata: function() {
        $(".wordlist-setting[data-var=title]").val(State.wordset.title);
        $(".wordlist-setting[data-var=author]").val(State.wordset.author);
        State.wordset.regexp == 1 ? $(".wordlist-setting[data-var=regexp]").addClass("active") : undefined
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
        
        
        
        tr.appendChild(num);
        tr.appendChild(questionTd);
        tr.appendChild(answerTd);
        tr.appendChild(removeTd);
        
        $("#wordlist table tbody").append(tr);
    },
    
    reverseList: function() {
        
        var newList = [];
        
        if (!!State.wordset.words && State.wordset.words.length > 0) {
            $("#loading").show();
            
            for (word in State.wordset.words) {
                newList.push([State.wordset.words[word][1], State.wordset.words[word][0]])
            }
            
            State.wordset.words = newList;
            
            Flashcards.refreshWordList();
            
            $("#loading").fadeOut('fast');
        }
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
    
    clearList: function() {
        State.wordset = { };
        Flashcards.refreshWordList();  
    },
    
    updateFontSetting: function() {
        Flashcards.config.get('font300') ? $("body").addClass("font-300") : $("body").removeClass("font-300");
        Flashcards.config.get('fontOld') ? $("body").addClass("font-classic") : $("body").removeClass("font-classic");
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
        
        $("*[rel=tooltip]").tooltip();

        $(window).konami(function(){
            $("#debug-modal textarea").val(
                navigator.userAgent + "\n\n" +
                JSON.stringify(State) + "\n\n" +
                JSON.stringify(window.localStorage)
                );
            $("#debug-modal").modal({show: true});
            Achievements.signal("konami");
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
        
        $("#wordlist-reverse").click(Flashcards.reverseList);
        
        $("input[data-var]").each(function(i, item) {
            if ($(this).attr('type') == 'checkbox') {
                $(item).attr('checked', Flashcards.config.get( $(item).data('var')) == "1" ); 
            } else {
                $(item).val( Flashcards.config.get( $(item).data('var')) );    
            }
             
        });
        
        $("#page-config input[data-var]").change(function(e) {
            if ($(this).data('var') == "wallpaper") { 
                Flashcards.setWallpaper($(this).val());
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
        
        $("#input12,#input13").change(Flashcards.updateFontSetting);
        Flashcards.updateFontSetting();
        
        $(".wordlist-setting").change(function(e) {
            var value = $(this).val();
            if ($(this).attr('type') == 'checkbox') {
                value = $(this).attr('checked') ? 1 : 0;
            }
            State.wordset[$(this).data('var')] = value;
        });
        
        $('.wordlist-setting.btn').click(function() {
           if ($(this).hasClass('btn')) {
               $(this).toggleClass('active')
               value = $(this).hasClass('active') ? 1 : 0;
            }
            State.wordset[$(this).data('var')] = value;
        });
        
        $("#bg").css('background-image', 'url("' + Flashcards.config.get('wallpaper') + '")');
        
        $(".card-buttons .submit").click(Flashcards.submitAnswer);
        $("#btn-start").click(Flashcards.startTraining);
        $("#btn-stop").click(function() {
            Flashcards.endTraining();
            Achievements.signal('cancel');
        });
        
        $("#btn-pause").click(function() {
            Achievements.trigger('nothing');
        });
        
        $("#confirm-clear .btn").click(function() {
           Flashcards.clearList(); 
        });
        
        $("*[rel=popover]").popover();
        
        $("#wordlist-purge").click(function() {
            $("#wordlist-purge").popover('toggle');
        });
        
        $("body").on('click', '#wordlist-purge-cancel', function() {
            $("#wordlist-purge").popover('hide');
        });
        
        $("body").on('click', '#wordlist-purge-confirm', function() {
            Flashcards.clearList();
        });
        
        $("#wordlist").on('click', '.wordlist-remove', function() {
            var arrayId = parseInt($(this).data('id'));
            delete State.wordset.words[arrayId];
            State.wordset.words = State.wordset.words.slice(); // Some dirty hacks
            State.wordset.words = State.wordset.words.filter(function(x){ return x != undefined});
                // Don't know why too. 
            Flashcards.refreshWordList();
        });
        
        $(window).unload(function() {
           localStorage.wordset = JSON.stringify(State.wordset);
        });
        
        $(window).load(function() {
           if (localStorage.wordset != undefined) {
               State.wordset = JSON.parse(localStorage.wordset);
               localStorage.removeItem("wordset");
               Flashcards.refreshWordList();
               Flashcards.refreshMetadata();
           } 
        });
        
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
            case 7: url = '/img/wallp/7.jpg'; break;
            case 8: url = '/img/wallp/8.jpg'; break;
            case 9: url = '/img/wallp/9.jpg'; break;
            case 10: url = '/img/wallp/10.jpg'; break;
            case 11: url = '/img/wallp/11.jpg'; break;
            case 12: url = '/img/wallp/12.jpg'; break;
            default: url = id;
        };
        Flashcards.config.set('wallpaper', url);
        $("#bg").fadeOut('slow');
        $("#bg").css('background-image', 'url("' + url + '")');
        $("#bg").fadeIn('slow');
        $("#input06").val(url);
        
        Achievements.signal('changeWallpaper', id);
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
            Achievements.signal("configSet", item, value);
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

Achievements = {
    
    /*
     * Supported events:
     * finish, answer, pageToggle, correct, wrong, importList, addWord
     * exportList, toBase64, cancel, changeWallpaper, start, configSet
     */
    
    data: {
        answer: {
            icon: "Ability_TownWatch.png",
            title: "Coś wiem!",
            description: "Podaj poprawną odpowiedź na pytanie." },
        wrong: {
            icon: "Achievement_BG_AB_kill_in_mine.png",
            title: "Zła odpowiedź!",
            description: "Podaj złą odpowiedź na pytanie." },
        fandf: {
            icon: "Spell_Fire_BlueRainOfFire.png",
            title: "Szybki i wściekły",
            description: "Odpowiedz poprawnie na 3 pytania w ciągu 10 sekund."},
        cancel: {
            icon: "ABILITY_SEAL.png",
            title: "Tchórz",
            description: "Zakończ ćwiczenie przed końcem."},
        secretmode: {
            icon: "Achievement_Boss_CThun.png",
            title: "Dark Side of the Flashcards",
            description: "Otwórz okno debugowania Flashcards.",
            hidden: true },
        setka: {
            icon: "INV_Alchemy_Elixir_03.png",
            title: "Setka",
            description: "Odpowiedz poprawnie na 100 pytań"},
        pollitra: {
            icon: "INV_Alchemy_Elixir_04.png",
            title: "Pół litra",
            description: "Odpowiedz poprawnie na 500 pytań"},
        stoprocent: {
            icon: "Achievement_Dungeon_UlduarRaid_Misc_06.png",
            title: "ĆZ 100%",
            description: "Ćwiczenie zrobione w 100% poprawnie."},
        ponad100: {
            icon: "INV_Misc_EngGizmos_27.png",
            title: "Ponad 100% poprawnych",
            description: "It's not a bug, it's a feature.",
            hidden: true },
        wallpaper: {
            icon: "INV_Fabric_Frostweave_Bolt.png",
            title: "Tapeciara",
            description: "Zmień tapetę na inną." },
        readme: {
            icon: "INV_Misc_Book_16.png",
            title: "Dobrze poinformowany",
            description: "Przeczytaj zakładkę „Informacje”",
            hidden: true },
        nocny: {
            icon: "Achievement_Halloween_Cat_01.png",
            title: "Nie spać, zwiedzać!",
            description: "Otwórz Flashcards po północy",
            hidden: true },
        importer: {
            icon: "Spell_Holy_PrayerOfFortitude.png",
            title: "Importer",
            description: "Zaimportuj paczkę z pytaniami" },
        pustak: {
            icon: "INV_Crate_03.png",
            title: "Pustak",
            description: "Pusta skrzynia za pustą odpowiedź!",
            hidden: true },
        wytrwaly: {
            icon: "INV_Misc_Head_Dragon_Green.png",
            title: "Wytrwały",
            description: "Wykonaj ćwiczenie na ponad 100 pytań." },
        blyskawica: {
            icon: "Warrior_talent_icon_Thunderstruck.png",
            title: "Błyskawica",
            description: "Ukończ ćwiczenie ze średnią prędkością 12 słów/minutę lub większą." },
        jackpot: {
            icon: "spell_Shaman_convection.png",
            title: "Jackpot!",
            description: "Odpowiedz poprawnie 20 razy z rzędu" },
        explorer: {
            icon: "INV_Jewelcrafting_StarOfElune_01.png",
            title: "Patrzcie, znalazłem!",
            description: "Zdobądź ukryte osiągnięcie" },
        prawie: {
            icon: "Item_azereansphere.png",
            title: "Prawie zdane",
            description: "Zrób dokładnie jeden błąd na ponad 50 pytań." },
        lekkie: {
            icon: "INV_Feather_12.png",
            title: "Lekkie jak piórko... albo nieco mniej",
            description: "Załaduj paczkę o objętości powyżej 1000 znaków" },
        sekretarz: {
            icon: "INV_Misc_Book_17.png",
            title: "Starszy sekretarz",
            description: "Dodaj 100 pytań" },
        hottentotten: {
            icon: "Achievement_Boss_LordMarrowgar.png",
            title: "Hottentotten…",
            description: "Odpowiedz na pytanie odpowiedzią o długości powyżej 25 znaków",
            hidden: true },
        palce: {
            icon: "Spell_Holy_SealOfSacrifice.png",
            title: "Moje biedne palce…",
            description: "Wpisz ponad 1000 znaków odpowiedzi w jednym uruchomieniu Flashcards." },
        aimiejego: {
            icon: "INV_Jewelcrafting_LivingRuby_01.png",
            title: "A imię jego czterdzieści i cztery",
            description: "Ukończ 44 ćwiczenia."
        },
        nothing: {
            icon: "Ability_Druid_Eclipse.png",
            title: "Obmacywacz",
            description: "Obmacując przyciski znajdź ten, który nie robi nic."
        },
        },
        
        
    procs: {
        correct: {
            answer: function() { Achievements.trigger('answer') },
            fandf: function() {
                var now = Math.floor(Date.now()/1000);
                var then = State.achi.fandf_time;
                
                if (now - then <= 10) {
                    if (State.achi.fandf_count == 3) Achievements.trigger('fandf');
                    else State.achi.fandf_count += 1;
                } else {
                  State.achi.fandf_count = 0;
                  State.achi.fandf_time = now;  
                }
            },
            setka: function() {
                var count = parseInt(localStorage.achi_setka_count)
                if (count == 100) Achievements.trigger('setka');
                else if (count > 0) localStorage.achi_setka_count = count + 1;
                else localStorage.achi_setka_count = 1;
            },
            pollitra: function() {
                var count = parseInt(localStorage.achi_500_count)
                if (count == 500) Achievements.trigger('pollitra');
                else if (count > 0) localStorage.achi_500_count = count + 1;
                else localStorage.achi_500_count = 1;
            },
            jackpot: function() {
                if (State.achi.jackpot_count == 20) Achievements.trigger('jackpot');
                else State.achi.jackpot_count += 1;
            },
        },
        wrong: {
            wrong: function() { Achievements.trigger('wrong') },
            fandf: function() { State.achi.fandf_count = 0 },
            fandf: function() { State.achi.jackpot_count = 0 },
            
        },
        cancel: {
            cancel: function() { Achievements.trigger('cancel') }
        },
        konami: {
            secretmode: function() { Achievements.trigger('secretmode') }
        },
        changeWallpaper: {
            wallpaper: function() { Achievements.trigger('wallpaper') }
        },
        nothing: {
            nothing: function() { Achievements.trigger('nothing') }
        },
        finish: {
            stoprocent: function() {
                if (State.statistics.correct == State.statistics.submitted)
                    Achievements.trigger('stoprocent');
            },
            ponad100: function() {
                if (State.statistics.correct > State.statistics.submitted)
                    Achievements.trigger('ponad100');
            },
            wytrwaly: function() {
                if (State.wordset.words.length > 100) Achievements.trigger("wytrwaly");
            },
            blyskawica: function() {
                var now = Math.floor(Date.now()/1000);
                var speed = State.wordset.words.length / (now - State.statistics.startTime); // [words / second]
                if (speed >= 0.1 /* 0.2 wps == 1 wpm */) Achievements.trigger('blyskawica');
            },
            prawie: function() {
                if (State.wordset.words.length <= 50) return false;
                if (State.statistics.submitted - State.statistics.correct == 1)
                    Achievements.trigger('prawie');
            },
            aimiejego: function() {
                var count = parseInt(localStorage.achi_aimiejego_count)
                if (count == 44) Achievements.trigger('aimiejego');
                else if (count > 0) localStorage.achi_aimiejego_count = count + 1;
                else localStorage.achi_aimiejego_count = 1;
            },
        },
        pageToggle: {
            readme: function() {
                if (arguments[0][1] == "info") Achievements.trigger("readme");
            },
            nocny: function() {
                var now = new Date();
                if (now.getHours() < 5 && now.getHours() >= 0) Achievements.trigger("nocny");
            }
        },
        importList: {
            importer: function() { Achievements.trigger('importer') },
            lekkie: function() {
                if ($("#import-modal textarea").val().length > 1000) Achievements.trigger('lekkie');
            },
        },
        answer: {
            pustak: function() { if (arguments[0][1] == "") Achievements.trigger("pustak"); },
            hottentotten: function() { if (arguments[0][1].length > 25) Achievements.trigger('hottentotten') },
            palce: function() {
                State.achi.palce_count += arguments[0][1].length;
                if (State.achi.palce_count >= 1000) Achievements.trigger('palce');
            },
        },
        achievement: {
            explorer: function() {
                var achi = Achievements.data[arguments[0][1]];
                if (achi.hidden) Achievements.trigger('explorer');
            },
        },
        addWord: {
            sekretarz: function() {
                var count = parseInt(localStorage.achi_sekretarz_count)
                if (count == 100) Achievements.trigger('sekretarz');
                else if (count < 100) localStorage.achi_sekretarz_count = count + 1;
                else localStorage.achi_sekretarz_count = 1;
            }
        },
        
    },
    
    signal: function(signal) {
        if (!Flashcards.config.get('achievementsEnable')) return false;
        
        var list = Achievements.getCompleted();
        
        for (i in Achievements.procs[signal]) {
            Achievements.procs[signal][i](arguments)
        }
        for (i in Achievements.procs.all) {        
            Achievements.procs.all[i](arguments)
        }
    },
    
    trigger: function(achi) {
        
        var data = Achievements.data[achi];
        if (Achievements.isCompleted(achi)) return true;
        
        var achi_div = document.querySelector("#achi-default").cloneNode(true);
        achi_div.removeAttribute("id");
        
        $(achi_div).find(".achi-icon img").attr('src', '/img/icons/' + data.icon);
        $(achi_div).find(".achi-title").html(data.title);
        $(achi_div).find(".achi-description").html(data.description);
        
        document.querySelector("#achievement-container").appendChild(achi_div);
        
        $(achi_div).slideDown(400).delay(2600).fadeOut(400);
        
        if (data.hidden) $(achi_div).find(".achi-header-hidden").delay(400).fadeIn(400);
        else $(achi_div).find(".achi-header-default").delay(400).fadeIn(400).delay(3200);
        
        setTimeout(function(achi_div) {
            achi_div.parentNode.removeChild(achi_div);
        }, 4000, achi_div);
        
        var list = Achievements.getCompleted();
        list.push(achi);
        localStorage['achievements'] = list.join(';');
        
        Achievements.signal('achievement', achi); // We need to go deeper.
        
        Achievements.updateList();
    },
    
    getCompleted: function() {
        if (State.achi.list == undefined) {
            if (localStorage.achievements != undefined) State.achi.list = localStorage['achievements'].split(';');
            else State.achi.list = [];
        }
        return State.achi.list;
    },
    
    isCompleted: function(achi) {
      if (!State.achi.list) return false;
      else {
          if (State.achi.list.indexOf(achi) >= 0) return true;
          else return false;
      }
    },
    
    updateList: function() {
        var table = document.querySelector("#achi-table tbody");
        $(table).html("");
        
        for (i in Achievements.data) {
            var completed = Achievements.isCompleted(i);
            if (Achievements.data[i].hidden && !completed) continue;
            
            var row = document.createElement("tr");
            
            if (!completed) $(row).addClass("disabled");
            
            var icon = document.createElement("td");
            var iconimg = document.createElement("img");
                iconimg.src = "/img/icons/" + Achievements.data[i].icon;
                icon.appendChild(iconimg);
                row.appendChild(icon);
            
            var title = document.createElement("td");
                title.innerHTML = Achievements.data[i].title;
                row.appendChild(title);
                
            var description = document.createElement("td"); 
                description.innerHTML = Achievements.data[i].description;
                row.appendChild(description);
                
            table.appendChild(row);
        }  
    },
    
    init: function() {
        Achievements.updateList();
        
    }
    
};

DefaultConfig =  {
    replayFailedWords: 1,
    font300: 0,
    fontOld: 0,
    rememberTime: 3000,
    wordListChunk: 20,
    quizMode: 0,
    cardAnimTime: 250,
    enableAnim: 1,
    matchCase: 0,
    matchPunctation: 1,
    repeatCount: 1,
    enableSound: 1,
    incorrectShow: false,
    achievementsEnable: true,
    separator: ';',
    wallpaper: "/img/wallp/8.jpg"
};

State = {
    trainingRunning: false,
    
    wordList: [],
    currentList: [],
    failedList: [], 
    totalWords: 0,
    doneWords: 0,
    curentWord: undefined,
    
    wordset: { },
    
    statistics: {
        submitted: 0,
        wrong: 0,
        correct: 0,
        failedWords: {}, // in format of {word: count, ...}
        startTime: 0, // unix timestamp
    },
    
    achi: {
        fandf_count: 0,
        fandf_time: 0,
        palce_count: 0
    },
    
    lastTimeout: 0,
};

Whoami = {
    webkit: window.navigator.userAgent.search("AppleWebKit"),
    firefox: window.navigator.userAgent.search("Firefox")
}

$(function() {
    Flashcards.init();
    Achievements.init();
});
