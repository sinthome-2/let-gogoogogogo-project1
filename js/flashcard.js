'use strict';

// 简化调度，有意不上 SRS 间隔算法：
// 每轮固定抽 ROUND_SIZE 张，优先错题本，差额从全量随机补足。
(function () {
  const ROUND_SIZE = 10;
  const STORAGE_KEY = 'flashcards-wrong';

  function pickRound(candidates, size, rng) {
    rng = rng || Math.random;
    var pool = candidates.slice();
    var count = Math.min(size, pool.length);
    var result = [];
    for (var i = 0; i < count; i++) {
      var index = Math.floor(rng() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  function readWrongIds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeWrongIds(ids) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      // ignore storage errors
    }
  }

  function gradeTerm(id, correct, wrongIds) {
    var set = new Set(wrongIds || []);
    if (correct) {
      set.delete(id);
    } else {
      set.add(id);
    }
    return Array.from(set);
  }

  function nextCandidates(allTerms, wrongIds) {
    var wrongSet = new Set(wrongIds || []);
    var wrongTerms = [];
    var restTerms = [];
    for (var i = 0; i < allTerms.length; i++) {
      var term = allTerms[i];
      if (wrongSet.has(term.id)) {
        wrongTerms.push(term);
      } else {
        restTerms.push(term);
      }
    }
    return wrongTerms.concat(restTerms);
  }

  window.Flashcards = {
    ROUND_SIZE: ROUND_SIZE,
    pickRound: pickRound,
    gradeTerm: gradeTerm,
    nextCandidates: nextCandidates
  };

  // UI
  var allTerms = [];
  var round = [];
  var index = 0;
  var wrongIds = readWrongIds();
  var container, cardInner, cardFront, cardBack, actions, result;

  function shuffle(array, rng) {
    rng = rng || Math.random;
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function renderCard() {
    container.classList.remove('flipped');
    if (index >= round.length) {
      renderSummary();
      return;
    }
    var term = round[index];
    cardFront.textContent = term.name;
    cardBack.innerHTML = '';
    var def = document.createElement('p');
    def.textContent = term.tldr || term.definition;
    cardBack.appendChild(def);
    if (term.aliases && term.aliases.length) {
      var aliases = document.createElement('p');
      aliases.className = 'flashcard-aliases';
      aliases.textContent = '别名：' + term.aliases.join(' / ');
      cardBack.appendChild(aliases);
    }
    result.textContent = (index + 1) + ' / ' + round.length;
    actions.innerHTML = '';
  }

  function renderSummary() {
    cardFront.textContent = '本轮完成';
    cardBack.innerHTML = '';
    actions.innerHTML = '';
    result.textContent = '';

    var newWrongIds = readWrongIds();
    if (newWrongIds.length === 0) {
      var done = document.createElement('p');
      done.className = 'flashcard-summary';
      done.textContent = '恭喜，当前错题本为空。';
      cardBack.appendChild(done);
    } else {
      var title = document.createElement('p');
      title.className = 'flashcard-summary';
      title.textContent = '错题回链（可点击查看词条）：';
      cardBack.appendChild(title);
      var list = document.createElement('ul');
      list.className = 'flashcard-wrong-list';
      newWrongIds.forEach(function (id) {
        var term = allTerms.find(function (t) {
          return t.id === id;
        });
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = './term/' + id + '/';
        a.textContent = term ? term.name : id;
        li.appendChild(a);
        list.appendChild(li);
      });
      cardBack.appendChild(list);
    }

    var restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'flashcard-btn';
    restart.textContent = '再来一轮';
    restart.addEventListener('click', startRound);
    actions.appendChild(restart);
  }

  function onAnswer(correct) {
    var term = round[index];
    wrongIds = gradeTerm(term.id, correct, wrongIds);
    writeWrongIds(wrongIds);
    index++;
    renderCard();
  }

  function flipCard() {
    container.classList.toggle('flipped');
    if (container.classList.contains('flipped')) {
      actions.innerHTML = '';
      var know = document.createElement('button');
      know.type = 'button';
      know.className = 'flashcard-btn flashcard-btn-know';
      know.textContent = '认识 (← 或 1)';
      know.addEventListener('click', function () {
        onAnswer(true);
      });
      var unknow = document.createElement('button');
      unknow.type = 'button';
      unknow.className = 'flashcard-btn flashcard-btn-unknow';
      unknow.textContent = '不认识 (→ 或 2)';
      unknow.addEventListener('click', function () {
        onAnswer(false);
      });
      actions.appendChild(know);
      actions.appendChild(unknow);
    }
  }

  function startRound() {
    var candidates = nextCandidates(allTerms, wrongIds);
    round = pickRound(candidates, ROUND_SIZE);
    index = 0;
    renderCard();
  }

  function initUI() {
    container = document.querySelector('[data-flashcard]');
    if (!container) return;
    cardInner = document.createElement('div');
    cardInner.className = 'flashcard-inner';
    cardFront = document.createElement('div');
    cardFront.className = 'flashcard-front';
    cardBack = document.createElement('div');
    cardBack.className = 'flashcard-back';
    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    container.appendChild(cardInner);

    actions = document.createElement('div');
    actions.className = 'flashcard-actions';
    container.parentNode.insertBefore(actions, container.nextSibling);

    result = document.createElement('div');
    result.className = 'flashcard-result';
    container.parentNode.insertBefore(result, actions.nextSibling);

    container.addEventListener('click', flipCard);
    container.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        flipCard();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!container.classList.contains('flipped')) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === '1' || event.key === '2') {
          event.preventDefault();
          flipCard();
        }
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === '1') {
        event.preventDefault();
        onAnswer(true);
      } else if (event.key === 'ArrowRight' || event.key === '2') {
        event.preventDefault();
        onAnswer(false);
      }
    });
  }

  function init() {
    initUI();
    if (!container) return;
    fetch('data/terms.json')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        allTerms = data.terms || [];
        wrongIds = readWrongIds();
        startRound();
      })
      .catch(function () {
        if (cardFront) cardFront.textContent = '加载术语数据失败';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
