/* BE·ON PASS — comportamento do site (relógio, próximo evento, busca, favoritos, cupom...) */

// Dados do site (cupom, contatos e eventos) ficam no bloco <script id="beon-data"> do index.html
var BEON = (function(){
  try{ return JSON.parse(document.getElementById('beon-data').textContent); }
  catch(e){ return {site: {}, events: []}; }
})();
var COUPON_CODE = BEON.site.coupon || 'THIAGOCAMBOIM';
function showToast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

function copyCode(){
  var text = COUPON_CODE;
  var btn = document.getElementById('copyBtn');
  function ok(){
    btn.textContent = "COPIADO ✓"; btn.classList.add('copied'); showToast('Cupom copiado!');
    setTimeout(function(){ btn.textContent = "COPIAR CÓDIGO"; btn.classList.remove('copied'); }, 1800);
  }
  function fallback(){
    try{
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var done = document.execCommand('copy'); document.body.removeChild(ta);
      if(done){ ok(); return; }
    }catch(e){}
    btn.textContent = "COPIE: " + text;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(ok).catch(fallback);
  } else { fallback(); }
}

// Relógio da barra superior (horário de Brasília)
(function(){
  var el = document.getElementById('clock');
  function tick(){
    var d = new Date(), tz = 'America/Sao_Paulo';
    try{
      var dia = d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', timeZone:tz});
      var hora = d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', timeZone:tz});
      el.textContent = 'Agora · ' + dia + ' · ' + hora;
    }catch(e){ el.textContent = ''; }
  }
  tick(); setInterval(tick, 15000);
})();

// Eventos: rollover automático + próximo evento + busca + favoritos
// Cada .event-card[data-date] é um evento (AAAA-MM-DD, horário de Brasília). Opcionais:
//   data-time="HH:MM" (início), data-end="AAAA-MM-DDTHH:MM" (fim), data-soldout (esgotado).
// Sem data-end o evento vale até 6h do dia seguinte.
(function(){
  var TZ = '-03:00', HOUR = 3600 * 1000;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.event-card[data-date]'));
  if(!cards.length) return;

  function dayStart(c){ return new Date(c.getAttribute('data-date') + 'T00:00:00' + TZ).getTime(); }
  function startOf(c){ return new Date(c.getAttribute('data-date') + 'T' + (c.getAttribute('data-time') || '00:00') + ':00' + TZ).getTime(); }
  function endOf(c){
    var e = c.getAttribute('data-end');
    return e ? new Date(e + ':00' + TZ).getTime() : dayStart(c) + 30 * HOUR;
  }
  function norm(t){ return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  var now = Date.now();
  var upcoming = cards.filter(function(c){ return endOf(c) > now; })
                      .sort(function(a, b){ return startOf(a) - startOf(b); });
  cards.forEach(function(c){
    var past = endOf(c) <= now;
    c.hidden = past;
    if(past) c.setAttribute('data-past', '1');
  });

  var nextSection = document.getElementById('next');
  var grid = document.getElementById('eventsGrid');
  var toolbar = document.getElementById('toolbar');
  var noEvents = document.getElementById('noEvents');
  var noResults = document.getElementById('noResults');

  if(!upcoming.length){
    if(nextSection) nextSection.hidden = true;
    grid.hidden = true; toolbar.hidden = true; noEvents.hidden = false;
    return;
  }

  /* ---------- Próximo evento: o mais próximo que ainda tem ingresso ---------- */
  var pick = upcoming.filter(function(c){ return !c.hasAttribute('data-soldout'); })[0] || upcoming[0];
  var img = pick.querySelector('.event-img');
  var nextImg = document.getElementById('nextImg');
  if(nextImg && img && nextImg.getAttribute('src') !== img.getAttribute('src')){
    nextImg.setAttribute('src', img.getAttribute('src'));
    document.getElementById('nextMedia').style.backgroundImage = 'url(' + img.getAttribute('src') + ')';
    nextImg.setAttribute('alt', img.getAttribute('alt') || '');
    if(img.getAttribute('width')) nextImg.setAttribute('width', img.getAttribute('width'));
    if(img.getAttribute('height')) nextImg.setAttribute('height', img.getAttribute('height'));
  }
  document.getElementById('nextTitle').textContent = pick.querySelector('h3').textContent;
  document.getElementById('nextMeta').textContent = pick.querySelector('.event-meta').textContent;

  var nextBuy = document.getElementById('nextBuy');
  nextBuy.setAttribute('data-id', pick.getAttribute('data-id'));
  var cardBtn = pick.querySelector('.buy-btn');
  if(pick.hasAttribute('data-soldout')){
    nextBuy.textContent = 'SOLD OUT'; nextBuy.classList.add('soldout');
    nextBuy.removeAttribute('href'); nextBuy.setAttribute('aria-disabled', 'true');
  } else if(cardBtn){
    nextBuy.setAttribute('href', cardBtn.getAttribute('href'));
    nextBuy.setAttribute('rel', cardBtn.getAttribute('rel') || 'noopener');
    nextBuy.textContent = pick.getAttribute('data-cta') || 'GARANTIR MEU INGRESSO';
  }

  var start = startOf(pick), dayS = dayStart(pick), hasTime = pick.hasAttribute('data-time');
  var tag = document.getElementById('nextTag');
  var countdown = document.getElementById('countdown');
  var elDays = document.getElementById('cd-days'), elHours = document.getElementById('cd-hours');
  var elMin = document.getElementById('cd-min'), elSec = document.getElementById('cd-sec');
  var timer;
  function pad(x){ return String(x).padStart(2, '0'); }
  function tick(){
    var n = Date.now(), diff = start - n;
    if(diff <= 0){
      tag.textContent = (!hasTime && n < dayS + 24 * HOUR) ? 'É hoje!' : 'Acontecendo agora';
      countdown.hidden = true;
      if(timer) clearInterval(timer);
      return;
    }
    tag.textContent = n >= dayS ? 'É hoje!' : 'Próximo evento';
    countdown.hidden = false;
    elDays.textContent = Math.floor(diff / (24 * HOUR));
    elHours.textContent = pad(Math.floor((diff % (24 * HOUR)) / HOUR));
    elMin.textContent = pad(Math.floor((diff % HOUR) / 60000));
    elSec.textContent = pad(Math.floor((diff % 60000) / 1000));
  }
  tick();
  if(start > Date.now()) timer = setInterval(tick, 1000);

  /* ---------- Favoritos (guardados no navegador) ---------- */
  var KEY = 'beon_favs_thiago';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; } }
  function save(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} }
  var favs = load();
  var onlyFav = /[?&]favorites=1/.test(location.search);
  var query = '';

  var search = document.getElementById('search');
  var favFilter = document.getElementById('favFilter');
  var favCount = document.getElementById('favCount');
  var bnFav = document.getElementById('bnFav');

  cards.forEach(function(c){
    c._text = norm(c.textContent.replace(/♥/g, '') + ' ' + (c.getAttribute('data-keywords') || ''));
  });

  function isFav(c){ return favs.indexOf(c.getAttribute('data-id')) > -1; }

  function apply(){
    var terms = norm(query).trim().split(/\s+/).filter(Boolean);
    var shown = 0, favTotal = 0;
    cards.forEach(function(c){
      if(c.getAttribute('data-past')) return;
      var fav = isFav(c); if(fav) favTotal++;
      var btn = c.querySelector('.fav-btn');
      btn.setAttribute('aria-pressed', String(fav));
      var ok = terms.every(function(t){ return c._text.indexOf(t) > -1; }) && (!onlyFav || fav);
      c.classList.toggle('f-hide', !ok);
      if(ok) shown++;
    });
    favCount.textContent = favTotal;
    favFilter.setAttribute('aria-pressed', String(onlyFav));
    bnFav.classList.toggle('active', onlyFav);
    noResults.textContent = (onlyFav && !terms.length && !favTotal)
      ? 'Você ainda não favoritou nenhum evento. Toque no ♥ de um card para salvar.'
      : 'Nenhum evento encontrado. Tente outro nome, artista, local ou mês.';
    noResults.hidden = shown > 0;
  }

  cards.forEach(function(c){
    c.querySelector('.fav-btn').addEventListener('click', function(){
      var id = c.getAttribute('data-id'), i = favs.indexOf(id);
      if(i > -1) favs.splice(i, 1); else favs.push(id);
      save(favs); apply();
    });
  });
  search.addEventListener('input', function(){ query = search.value; apply(); });
  favFilter.addEventListener('click', function(){ onlyFav = !onlyFav; apply(); });

  var eventos = document.getElementById('eventos');
  document.getElementById('bnSearch').addEventListener('click', function(){
    eventos.scrollIntoView({behavior: 'smooth', block: 'start'});
    setTimeout(function(){ search.focus({preventScroll: true}); }, 450);
  });
  bnFav.addEventListener('click', function(){
    onlyFav = !onlyFav; apply();
    if(onlyFav) eventos.scrollIntoView({behavior: 'smooth', block: 'start'});
  });

  apply();
})();

// Selo de data (dia + mês) sobre a arte de cada card
(function(){
  var MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  document.querySelectorAll('.event-card[data-date]').forEach(function(c){
    var media = c.querySelector('.event-media');
    var p = (c.getAttribute('data-date') || '').split('-');
    if(!media || p.length !== 3 || media.querySelector('.date-chip')) return;
    var chip = document.createElement('div');
    chip.className = 'date-chip'; chip.setAttribute('aria-hidden', 'true');
    chip.innerHTML = '<b>' + Number(p[2]) + '</b><span>' + MESES[Number(p[1]) - 1] + '</span>';
    media.appendChild(chip);
  });
})();

// Conversão: contagem por card, compartilhar, salvar na agenda e cupom copiado ao comprar
(function(){
  var COUPON = COUPON_CODE;
  var PAGE = 'https://camboim123.github.io/be-on-eventos/';
  var DAY = 24 * 3600 * 1000;

  function todayBR(){ // data de hoje em Brasília, AAAA-MM-DD
    try{ return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date()); }
    catch(e){ return new Date().toISOString().slice(0, 10); }
  }
  function daysUntil(date){
    return Math.round((new Date(date + 'T00:00:00Z') - new Date(todayBR() + 'T00:00:00Z')) / DAY);
  }
  function ymd(d){ return d.replace(/-/g, ''); }
  function nextDay(date){ return new Date(new Date(date + 'T00:00:00Z').getTime() + DAY).toISOString().slice(0, 10); }

  document.querySelectorAll('.event-card[data-date]').forEach(function(c){
    if(c.hasAttribute('data-past')) return;
    var date = c.getAttribute('data-date');
    var title = c.querySelector('h3').textContent.trim();
    var meta = c.querySelector('.event-meta').textContent;
    var place = (meta.split('📍')[1] || 'São Paulo').trim();
    var buy = c.querySelector('.buy-btn');
    var body = c.querySelector('.event-body');

    // 1) Contagem regressiva no card
    var tag = c.querySelector('.event-tag');
    if(tag && !c.querySelector('.countdown-pill') && !c.hasAttribute('data-soldout')){
      var n = daysUntil(date), txt = n <= 0 ? 'É hoje!' : n === 1 ? 'É amanhã!' : 'Faltam ' + n + ' dias';
      var row = document.createElement('div'); row.className = 'tag-row';
      tag.parentNode.insertBefore(row, tag); row.appendChild(tag);
      var pill = document.createElement('span');
      pill.className = 'countdown-pill' + (n <= 7 ? ' hot' : '');
      pill.textContent = txt; row.appendChild(pill);
    }

    // 2) Compartilhar + 3) Salvar na agenda
    if(!c.querySelector('.card-actions')){
      var actions = document.createElement('div'); actions.className = 'card-actions';
      var share = document.createElement('button'); share.type = 'button'; share.innerHTML = '↗ Compartilhar';
      share.setAttribute('aria-label', 'Compartilhar ' + title);
      var shareText = title + ' — ' + meta.replace(/📅|📍/g, '').replace(/\s+/g, ' ').trim() +
        '. Ingresso com 5% OFF usando o cupom ' + COUPON + ':';
      var shareUrl = PAGE + '#' + c.getAttribute('data-id');
      share.addEventListener('click', function(){
        if(navigator.share){
          navigator.share({title: title, text: shareText, url: shareUrl}).catch(function(){});
        } else {
          window.open('https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + shareUrl), '_blank', 'noopener');
        }
      });
      var time = c.getAttribute('data-time'), end = c.getAttribute('data-end');
      var dates = time
        ? ymd(date) + 'T' + time.replace(':', '') + '00/' + (end ? ymd(end.slice(0, 10)) + 'T' + end.slice(11).replace(':', '') + '00' : ymd(nextDay(date)) + 'T060000')
        : ymd(date) + '/' + ymd(nextDay(date));
      var cal = document.createElement('a');
      cal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(title) + '&dates=' + dates + '&ctz=America/Sao_Paulo' +
        '&location=' + encodeURIComponent(place) +
        '&details=' + encodeURIComponent('Ingresso com 5% OFF (cupom ' + COUPON + '): ' + (buy && buy.href ? buy.href : PAGE));
      cal.target = '_blank'; cal.rel = 'noopener'; cal.innerHTML = '📅 Salvar na agenda';
      cal.setAttribute('aria-label', 'Salvar ' + title + ' na agenda');
      actions.appendChild(share); actions.appendChild(cal);
      body.appendChild(actions);
    }
    c.id = c.id || c.getAttribute('data-id');
  });

  // 4) Ao clicar em comprar, o cupom também vai para a área de transferência
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a.buy-btn');
    if(!a || /wa\.me/.test(a.href)) return;
    try{ navigator.clipboard && navigator.clipboard.writeText(COUPON); }catch(err){}
    showToast('Cupom ' + COUPON + ' copiado · 5% OFF no link');
  });
})();

// Revelar blocos ao rolar a página
(function(){
  var els = document.querySelectorAll('.next-card, .event-card, .about-card, .how-item, .faq-item, .section-title');
  if(!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {rootMargin: '0px 0px -8% 0px'});
  els.forEach(function(el){ el.classList.add('reveal'); io.observe(el); });
})();

// Acordeão das dúvidas rápidas
document.querySelectorAll('.faq-q').forEach(function(btn){
  btn.addEventListener('click', function(){
    var item = btn.closest('.faq-item');
    var isOpen = item.classList.contains('open');
    item.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
});

// Estatísticas de acesso (GoatCounter): visitas + cliques importantes, para o painel local.
// Só liga quando "goatcounter" estiver preenchido no beon-data (ex.: "beon-thiago"). Não usa cookies.
(function(){
  var code = (BEON.site.goatcounter || '').trim();
  if(!code) return;
  var queue = [];
  function send(path, title){
    if(window.goatcounter && window.goatcounter.count){
      window.goatcounter.count({path: path, title: title || path, event: true});
    } else { queue.push([path, title]); }
  }
  var s = document.createElement('script');
  s.async = true; s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
  s.onload = function(){
    // count.js conta a visita sozinho; aqui só enviamos os cliques que aconteceram antes de carregar
    var wait = setInterval(function(){
      if(!(window.goatcounter && window.goatcounter.count)) return;
      clearInterval(wait);
      queue.splice(0).forEach(function(q){ send(q[0], q[1]); });
    }, 200);
  };
  document.head.appendChild(s);

  function eventId(el){
    var card = el.closest('.event-card');
    if(card) return card.getAttribute('data-id');
    var nb = el.closest('#nextBuy');
    return nb ? (nb.getAttribute('data-id') || 'destaque') : '';
  }

  document.addEventListener('click', function(e){
    var el = e.target.closest && e.target.closest('a, button');
    if(!el) return;
    var id = eventId(el), href = el.getAttribute('href') || '';
    if(el.matches('a.buy-btn') && !/wa\.me/.test(href)){
      send('clique/comprar/' + id, 'Comprar: ' + id);
    } else if(el.closest('.card-actions')){
      send((el.tagName === 'BUTTON' ? 'clique/compartilhar/' : 'clique/agenda/') + id,
           (el.tagName === 'BUTTON' ? 'Compartilhar: ' : 'Agenda: ') + id);
    } else if(/wa\.me\/55/.test(href)){
      send('clique/whatsapp/' + (id || el.id || 'pagina'), 'WhatsApp');
    } else if(/instagram\.com/.test(href)){
      send('clique/instagram', 'Instagram');
    } else if(el.id === 'copyBtn'){
      send('clique/copiar-cupom', 'Copiar cupom');
    } else if(el.matches('.fav-btn') && el.getAttribute('aria-pressed') !== 'true'){
      send('clique/favoritar/' + id, 'Favoritar: ' + id);
    }
  }, true);
})();
