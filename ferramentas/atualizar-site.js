#!/usr/bin/env node
/*
 * Atualiza o index.html a partir da lista de eventos (bloco <script id="beon-data"> no próprio index.html).
 *
 * Uso (na pasta do projeto):   node ferramentas/atualizar-site.js
 *
 * O que ele refaz automaticamente:
 *   - os cards de eventos (entre <!-- BEON:EVENTS:START --> e <!-- BEON:EVENTS:END -->)
 *   - o bloco "Próximo evento" (versão estática, antes do JavaScript rodar)
 *   - os dados estruturados para o Google (<script type="application/ld+json">)
 *   - a data de atualização no sitemap.xml
 *
 * Eventos que já terminaram ficam de fora dos cards e do Google (mas continuam na lista, se você quiser manter o histórico).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://camboim123.github.io/be-on-eventos/';
const TZ = '-03:00';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

let html = fs.readFileSync(INDEX, 'utf8');
const NL = html.includes('\r\n') ? '\r\n' : '\n';

function block(re, name) {
  const m = html.match(re);
  if (!m) throw new Error('Não encontrei ' + name + ' no index.html');
  return m;
}

const dataMatch = block(/(<script type="application\/json" id="beon-data">\s*)([\s\S]*?)(\s*<\/script>)/, 'o bloco beon-data');
const data = JSON.parse(dataMatch[2]);
const site = data.site;
const coupon = site.coupon;

// ---------- helpers ----------
const esc = s => String(s).replace(/&(?!(?:[a-z]+|#\d+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const longDate = d => { const [y, m, dd] = d.split('-').map(Number); return dd + ' de ' + MESES[m - 1] + ' de ' + y; };
const endMs = e => e.end
  ? new Date(e.end + ':00' + TZ).getTime()
  : new Date(e.date + 'T00:00:00' + TZ).getTime() + 30 * 3600e3; // sem "end": vale até 6h do dia seguinte
const place = e => e.venue + (e.venue !== e.city ? ', ' + e.city : '');
const meta = e => '📅 ' + longDate(e.date) + (e.horario ? ' · ' + e.horario : '') + ' · 📍 ' + place(e);

const now = Date.now();
const upcoming = data.events
  .filter(e => endMs(e) > now)
  .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

// ---------- cards ----------
function card(e, i) {
  const I = '      ';
  const attrs = [
    `class="event-card c${(i % 6) + 1}${e.soldout ? ' is-soldout' : ''}"`,
    `data-id="${esc(e.id)}"`, `data-date="${e.date}"`, `data-short="${esc(e.short)}"`,
    e.time && `data-time="${e.time}"`, e.end && `data-end="${e.end}"`,
    e.soldout && 'data-soldout', e.keywords && `data-keywords="${esc(e.keywords)}"`, e.cta && `data-cta="${esc(e.cta)}"`
  ].filter(Boolean).join(' ');
  const badge = e.badgeMode === 'soldout' || e.soldout
    ? '<span class="event-badge soft">Ingressos esgotados</span>'
    : e.badgeMode === 'custom'
      ? `<span class="event-badge soft">${e.badgeText}</span>`
      : `<span class="event-badge">✓ 5% OFF com ${coupon}</span>`;
  const buy = e.soldout
    ? '<span class="buy-btn soldout" aria-disabled="true">SOLD OUT</span>'
    : `<a class="buy-btn" href="${esc(e.buyHref)}" target="_blank" rel="${e.buyRel || 'noopener sponsored'}">${e.buyLabel || 'COMPRAR INGRESSO'}</a>`;
  return [
    `<div ${attrs}>`,
    `  <button class="fav-btn" type="button" aria-pressed="false" aria-label="Favoritar ${esc(e.short)}" title="Favoritar">♥</button>`,
    `  <div class="event-media" style="background-image:url(img/${e.img})">`,
    `    <img class="event-img" src="img/${e.img}" width="${e.imgW}" height="${e.imgH}" loading="lazy" decoding="async" alt="${esc(e.alt)}">`,
    e.soldout && '    <div class="sold-stamp" aria-hidden="true"><span>SOLD OUT</span></div>',
    '  </div>',
    '  <div class="event-body">',
    `    <span class="event-tag">${e.tag}</span>`,
    `    <h3>${e.title.toUpperCase()}</h3>`,
    `    <p class="event-meta">${meta(e)}</p>`,
    `    <p class="event-desc">${e.desc}</p>`,
    `    ${badge}`,
    `    ${buy}`,
    '  </div>',
    '</div>'
  ].filter(Boolean).map(l => I + l).join(NL);
}

html = html.replace(/(<!-- BEON:EVENTS:START -->)[\s\S]*?(\r?\n *<!-- BEON:EVENTS:END -->)/,
  (m, a, b) => a + NL + upcoming.map(card).join(NL + NL) + b);

// ---------- próximo evento (estático) ----------
const next = upcoming.find(e => !e.soldout) || upcoming[0];
if (next) {
  html = html
    .replace(/(<div class="next-media" id="nextMedia" style=")[^"]*(")/, `$1background-image:url(img/${next.img})$2`)
    .replace(/<img class="next-img" id="nextImg"[^>]*>/,
      `<img class="next-img" id="nextImg" src="img/${next.img}" width="${next.imgW}" height="${next.imgH}" fetchpriority="high" alt="${esc(next.alt)}">`)
    .replace(/(<h3 class="display" id="nextTitle">)[^<]*(<\/h3>)/, `$1${next.title.toUpperCase()}$2`)
    .replace(/(<p class="next-meta" id="nextMeta">)[^<]*(<\/p>)/, `$1${meta(next)}$2`)
    .replace(/<a class="buy-btn" id="nextBuy"[^>]*>[^<]*<\/a>/, next.soldout
      ? '<a class="buy-btn soldout" id="nextBuy" aria-disabled="true">SOLD OUT</a>'
      : `<a class="buy-btn" id="nextBuy" href="${esc(next.buyHref)}" target="_blank" rel="${next.buyRel || 'noopener sponsored'}">${next.cta || 'GARANTIR MEU INGRESSO'}</a>`);
}

// ---------- dados estruturados (Google) ----------
const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite', '@id': SITE_URL + '#site', url: SITE_URL, name: 'BE·ON PASS', inLanguage: 'pt-BR',
      description: 'Curadoria de eventos de música eletrônica da Be-On em São Paulo, com 5% de desconto no cupom ' + coupon + '.',
      author: { '@id': SITE_URL + '#thiago' }
    },
    {
      '@type': 'Person', '@id': SITE_URL + '#thiago', name: 'Thiago Augusto Sarafana Camboim',
      jobTitle: 'Embaixador Be-On', image: SITE_URL + 'img/thiago.webp',
      sameAs: ['https://www.instagram.com/' + site.instagram + '/']
    },
    ...upcoming.map(e => {
      const ev = {
        '@type': 'Event',
        name: e.ldName || text(e.title),
        startDate: e.date + (e.time ? 'T' + e.time + ':00' + TZ : ''),
        endDate: e.end ? e.end + ':00' + TZ : undefined,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: {
          '@type': 'Place', name: e.venue,
          address: Object.assign({ '@type': 'PostalAddress' },
            e.address ? { streetAddress: e.address } : {},
            { addressLocality: e.city, addressRegion: e.state, addressCountry: 'BR' })
        },
        image: [SITE_URL + 'img/' + e.img],
        description: text(e.ldDescShort || e.desc),
        url: e.ldUrl || SITE_URL + '#' + e.id,
        organizer: { '@type': 'Organization', name: 'Be-On' },
        performer: (e.performers || []).length
          ? e.performers.map(n => ({ '@type': 'PerformingGroup', name: n }))
          : undefined,
        offers: {
          '@type': 'Offer',
          url: e.buyHref,
          availability: e.soldout ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
        }
      };
      return JSON.parse(JSON.stringify(ev)); // remove campos vazios
    })
  ]
};
html = html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
  (m, a, b) => a + NL + JSON.stringify(ld, null, 2).replace(/\n/g, NL) + NL + b);

fs.writeFileSync(INDEX, html);

// ---------- sitemap ----------
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
if (fs.existsSync(SITEMAP)) {
  fs.writeFileSync(SITEMAP, fs.readFileSync(SITEMAP, 'utf8').replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`));
}

console.log('Pronto! ' + upcoming.length + ' evento(s) no site: ' + upcoming.map(e => e.short).join(', '));
if (next) console.log('Próximo evento em destaque: ' + next.short);
