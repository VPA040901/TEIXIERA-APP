/* Teixeira Gestão — dados sincronizados com Supabase + cache local */

const NAV = [
  ['inicio','⌂','Início'],
  ['gestao','▥','Gestão'],
  ['pedidos','▤','Pedidos'],
  ['agenda','▦','Agenda'],
  ['financeiro','＄','Financeiro'],
  ['clientes','♙','Clientes'],
  ['produtos','◇','Peças & estoque'],
  ['servicos','✳','Serviços'],
  ['documentos','▧','Documentos'],
  ['configuracoes','⚙','Preferências']
];

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

const SEED = {
  clientes:[
    {
      id:'c1',
      nome:'Mariana Costa',
      telefone:'(11) 98842-1060',
      email:'mariana@email.com',
      cidade:'São Paulo',
      observacoes:'Prefere contato pelo WhatsApp'
    },
    {
      id:'c2',
      nome:'Studio Arco',
      telefone:'(11) 97710-2340',
      email:'oi@studioarco.com',
      cidade:'São Paulo',
      observacoes:''
    },
    {
      id:'c3',
      nome:'Rafael Mendes',
      telefone:'(11) 99218-4401',
      email:'rafael@email.com',
      cidade:'Guarulhos',
      observacoes:''
    }
  ],

  produtos:[
    {
      id:'p1',
      nome:'Kit Essencial',
      codigo:'KIT-001',
      categoria:'Kits',
      preco:189.9,
      custo:82,
      estoque:12
    },
    {
      id:'p2',
      nome:'Vela Teixeira',
      codigo:'VEL-015',
      categoria:'Velas',
      preco:58,
      custo:22,
      estoque:4
    }
  ],

  servicos:[
    {
      id:'s1',
      nome:'Consultoria inicial',
      categoria:'Consultoria',
      preco:180,
      descricao:'Atendimento de 60 minutos'
    },
    {
      id:'s2',
      nome:'Projeto personalizado',
      categoria:'Projetos',
      preco:450,
      descricao:''
    }
  ],

  pedidos:[
    {
      id:'o1',
      numero:'PED-024',
      cliente:'Mariana Costa',
      descricao:'Kit Essencial + embalagem',
      total:209.9,
      status:'Aprovado',
      data:todayISO()
    },
    {
      id:'o2',
      numero:'PED-023',
      cliente:'Studio Arco',
      descricao:'Consultoria inicial',
      total:180,
      status:'Pendente',
      data:todayISO()
    }
  ],

  agenda:[
    {
      id:'a1',
      titulo:'Consultoria inicial',
      cliente:'Mariana Costa',
      data:todayISO(),
      hora:'10:30',
      status:'Confirmado',
      obs:''
    },
    {
      id:'a2',
      titulo:'Retorno do projeto',
      cliente:'Studio Arco',
      data:todayISO(),
      hora:'14:00',
      status:'Pendente',
      obs:''
    }
  ],

  lancamentos:[
    {
      id:'f1',
      tipo:'receita',
      descricao:'Pedido PED-024',
      cliente:'Mariana Costa',
      categoria:'Vendas',
      valor:209.9,
      data:todayISO(),
      forma:'Pix'
    },
    {
      id:'f2',
      tipo:'despesa',
      descricao:'Materiais de produção',
      cliente:'',
      categoria:'Materiais',
      valor:64.5,
      data:todayISO(),
      forma:'Cartão'
    }
  ],

  documentos:[],

  config:{
    empresa:'Teixeira',
    telefone:'',
    email:'',
    endereco:'',
    moeda:'BRL'
  }
};

function loadState(){
  try{
    const saved =
      JSON.parse(
        localStorage.getItem('teixeira-app-v1')
      );

    if(saved){
      return {
        ...structuredClone(SEED),
        ...saved,
        config:{
          ...SEED.config,
          ...(saved.config || {})
        }
      };
    }
  }catch(e){
    console.warn('Não foi possível carregar o cache local.',e);
  }

  return structuredClone(SEED);
}

let db = loadState();

let current = 'inicio';
let searchTerm = '';
let monthCursor = new Date();
let agendaSelected = todayISO();
let selectedOrderId = null;
let orderListTab = 'todos';

let cloudReady = false;
let cloudSyncTimer = null;
let cloudSyncRunning = false;

function money(v){
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style:'currency',
      currency:db.config?.moeda || 'BRL'
    }
  ).format(Number(v) || 0);
}

function esc(v=''){
  return String(v).replace(
    /[&<>"']/g,
    c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c])
  );
}

function initials(v=''){
  return v
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,2)
    .map(x => x[0])
    .join('')
    .toUpperCase() || '•';
}

const $ = s => document.querySelector(s);

function toast(text){
  const el = $('#toast');

  if(!el) return;

  el.textContent = text;
  el.classList.add('show');

  setTimeout(
    () => el.classList.remove('show'),
    2500
  );
}

function setPage(key){
  current = key;
  searchTerm = '';
  render();
}

function navItem(item,small=false){
  return `
    <button
      class="nav-item ${current===item[0]?'active':''}"
      data-page="${item[0]}"
    >
      <span class="nav-icon">${item[1]}</span>
      <span>${item[2]}</span>
    </button>
  `;
}

/* =========================================================
   SUPABASE / API
========================================================= */

function persist(){
  localStorage.setItem(
    'teixeira-app-v1',
    JSON.stringify(db)
  );

  if(!cloudReady) return;

  clearTimeout(cloudSyncTimer);

  cloudSyncTimer = setTimeout(
    () => syncAllToCloud(),
    400
  );
}

async function apiRequest(url,options={}){
  const response = await fetch(
    url,
    {
      ...options,
      headers:{
        'Content-Type':'application/json',
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try{
    data = await response.json();
  }catch{}

  if(!response.ok){
    throw new Error(
      data.message ||
      `Erro HTTP ${response.status}`
    );
  }

  return data;
}

function hasCloudData(data){
  if(!data || typeof data !== 'object'){
    return false;
  }

  return [
    'clientes',
    'produtos',
    'servicos',
    'pedidos',
    'agenda',
    'lancamentos',
    'documentos'
  ].some(
    type =>
      Array.isArray(data[type]) &&
      data[type].length > 0
  );
}

async function syncTable(table,rows){
  await apiRequest(
    `/api/data/${table}`,
    {
      method:'POST',
      body:JSON.stringify({
        rows:rows || []
      })
    }
  );
}

async function syncConfig(){
  await apiRequest(
    '/api/data/config',
    {
      method:'POST',
      body:JSON.stringify({
        data:db.config || {}
      })
    }
  );
}

async function syncAllToCloud(){

  if(
    cloudSyncRunning ||
    !cloudReady
  ){
    return;
  }

  cloudSyncRunning = true;

  try{

    await syncTable(
      'clientes',
      db.clientes || []
    );

    await syncTable(
      'produtos',
      db.produtos || []
    );

    await syncTable(
      'servicos',
      db.servicos || []
    );

    await syncTable(
      'pedidos',
      db.pedidos || []
    );

    await syncTable(
      'agenda',
      db.agenda || []
    );

    await syncTable(
      'lancamentos',
      db.lancamentos || []
    );

    await syncTable(
      'documentos',
      db.documentos || []
    );

    await syncConfig();

    console.log(
      'Dados sincronizados com o Supabase.'
    );

  }catch(error){

    console.warn(
      'Falha ao sincronizar com Supabase:',
      error
    );

  }finally{

    cloudSyncRunning = false;

  }
}

async function deleteFromCloud(type,id){

  if(
    !cloudReady ||
    !id
  ){
    return;
  }

  try{

    await apiRequest(
      `/api/data/${type}/${encodeURIComponent(id)}`,
      {
        method:'DELETE'
      }
    );

  }catch(error){

    console.warn(
      'Falha ao excluir no Supabase:',
      error
    );

  }
}

async function initializeCloud(){

  try{

    cloudReady = true;

    const result =
      await apiRequest('/api/data');

    if(!result?.data){
      throw new Error(
        'O servidor não retornou os dados.'
      );
    }

    const remote = result.data;

    if(hasCloudData(remote)){

      db = {
        ...db,
        ...remote,

        clientes:
          remote.clientes || [],

        produtos:
          remote.produtos || [],

        servicos:
          remote.servicos || [],

        pedidos:
          remote.pedidos || [],

        agenda:
          remote.agenda || [],

        lancamentos:
          remote.lancamentos || [],

        documentos:
          remote.documentos || [],

        config:{
          ...db.config,
          ...(remote.config || {})
        }
      };

      localStorage.setItem(
        'teixeira-app-v1',
        JSON.stringify(db)
      );

      render();

      toast(
        'Dados sincronizados com a nuvem'
      );

    }else{

      await syncAllToCloud();

      render();

      toast(
        'Dados enviados para a nuvem'
      );
    }

  }catch(error){

    cloudReady = false;

    console.warn(
      'Supabase indisponível:',
      error
    );

    render();

    toast(
      'Nuvem indisponível. Aplicativo usando cache local.'
    );
  }
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function init(){

  $('#side-nav').innerHTML =
    NAV.map(n => navItem(n)).join('');

  $('#bottom-nav').innerHTML =
    [NAV[0],NAV[1]]
      .map(n => navItem(n,true))
      .join('');

  document.addEventListener(
    'click',
    onClick
  );

  document.addEventListener(
    'input',
    onInput
  );

  document.addEventListener(
    'submit',
    onSubmit
  );

  if($('#global-search-btn')){
    $('#global-search-btn').onclick =
      openGlobalSearch;
  }

  if($('#audio-assistant')){
    $('#audio-assistant').onclick =
      openVoiceAssistant;
  }

  if($('#menu-toggle')){
    $('#menu-toggle').onclick = () =>
      $('#side-nav')
        .classList
        .toggle('mobile-show');
  }

  render();
}

function onClick(e){

  const nav =
    e.target.closest('[data-page]');

  if(nav){

    setPage(nav.dataset.page);

    $('#side-nav')
      ?.classList
      .remove('mobile-show');

    return;
  }

  const act =
    e.target.closest('[data-action]');

  if(!act) return;

  const {
    action,
    id,
    type
  } = act.dataset;

  if(action==='new'){
    openForm(
      type || entityForPage()
    );
  }

  if(action==='edit'){
    openForm(
      type,
      id
    );
  }

  if(action==='delete'){
    removeRecord(
      type,
      id
    );
  }

  if(action==='view-client'){
    showClient(id);
  }

  if(action==='open'){
    setPage(
      act.dataset.page
    );
  }

  if(action==='select-day'){
    agendaSelected =
      act.dataset.date;

    render();
  }

  if(action==='month-prev'){
    monthCursor.setMonth(
      monthCursor.getMonth()-1
    );

    render();
  }

  if(action==='month-next'){
    monthCursor.setMonth(
      monthCursor.getMonth()+1
    );

    render();
  }

  if(action==='quick-search'){
    openGlobalSearch();
  }

  if(action==='whatsapp'){

    const c =
      db.clientes.find(
        x => x.id===id
      );

    if(c){

      window.open(
        `https://wa.me/${(
          c.whatsapp ||
          c.telefone ||
          ''
        ).replace(/\D/g,'')}`,
        '_blank',
        'noopener'
      );
    }
  }

  if(action==='duplicate'){

    const list =
      findList(type);

    const item =
      list.find(x => x.id===id);

    if(item){

      const copy = {
        ...item,
        id:crypto.randomUUID(),
        numero:
          `${item.numero || ''}-CÓPIA`
      };

      list.unshift(copy);

      persist();
      render();

      toast(
        'Registro duplicado'
      );
    }
  }

  if(action==='convert'){

    const q =
      db.documentos.find(
        x => x.id===id
      );

    if(q){

      db.pedidos.unshift({
        id:crypto.randomUUID(),
        numero:
          `PED-${String(
            db.pedidos.length+1
          ).padStart(3,'0')}`,
        cliente:q.cliente,
        descricao:q.descricao,
        total:q.total,
        status:'Pendente',
        data:todayISO()
      });

      persist();

      setPage('pedidos');

      toast(
        'Orçamento convertido em pedido'
      );
    }
  }

  if(action==='export'){

    const s = calcSummary();

    const content =
`Resumo Teixeira
Receitas: ${money(s.receitas)}
Despesas: ${money(s.despesas)}
Resultado: ${money(s.saldo)}
Pedidos: ${db.pedidos.length}
Clientes: ${db.clientes.length}`;

    const a =
      document.createElement('a');

    a.href =
      URL.createObjectURL(
        new Blob(
          [content],
          {type:'text/csv'}
        )
      );

    a.download =
      'resumo-teixeira.csv';

    a.click();

    URL.revokeObjectURL(
      a.href
    );
  }
}

function onInput(e){

  if(
    e.target.matches('[data-filter]')
  ){

    searchTerm =
      e.target.value.toLowerCase();

    renderTableRows();
  }
}

function onSubmit(e){

  if(
    e.target.id==='record-form'
  ){

    e.preventDefault();

    saveRecord(
      new FormData(e.target)
    );

    return;
  }

  if(
    e.target.id==='global-search-form'
  ){

    e.preventDefault();

    const term =
      new FormData(e.target)
        .get('q');

    searchTerm =
      String(term || '')
        .toLowerCase();

    $('#modal-root').innerHTML='';

    const found =
      findAll(searchTerm);

    if(found.length){

      const first =
        found[0];

      setPage(first.type);

    }else{

      toast(
        'Nenhum resultado encontrado'
      );
    }
  }
}

/* =========================================================
   RENDER
========================================================= */

function render(){

  const nav =
    NAV.find(
      x => x[0]===current
    );

  $('#page-crumb').textContent =
    nav?.[2] || 'Início';

  $('#side-nav').innerHTML =
    NAV.map(n => navItem(n)).join('');

  $('#bottom-nav').innerHTML =
    [NAV[0],NAV[1]]
      .map(n => navItem(n,true))
      .join('');

  const root =
    $('#view');

  root.innerHTML =
    current==='inicio'
      ? dashboard()
      : current==='gestao'
      ? gestaoPage()
      : current==='pedido-detalhe'
      ? orderDetailPage()
      : current==='agenda'
      ? agendaPage()
      : [
          'clientes',
          'produtos',
          'servicos',
          'pedidos',
          'documentos'
        ].includes(current)
      ? listPage(current)
      : current==='financeiro'
      ? financePage()
      : current==='relatorios'
      ? reportsPage()
      : settingsPage();

  if(current==='inicio'){

    const mainButton =
      root.querySelector(
        '.page-head button[data-type="pedidos"]'
      );

    if(mainButton){

      const actions =
        document.createElement('div');

      actions.className =
        'home-head-actions';

      mainButton.replaceWith(
        actions
      );

      actions.append(
        mainButton
      );

      const audio =
        document.createElement('button');

      audio.className =
        'button audio-home';

      audio.type =
        'button';

      audio.innerHTML =
        '<span>🎙</span> Falar por áudio';

      audio.setAttribute(
        'aria-label',
        'Gravar áudio e criar um rascunho com IA'
      );

      audio.onclick =
        openVoiceAssistant;

      actions.append(audio);
    }

    root.insertAdjacentHTML(
      'beforeend',
      homeTiles()
    );
  }

  if(current==='configuracoes'){

    root.insertAdjacentHTML(
      'afterbegin',
      preferencesMenu()
    );

    root.insertAdjacentHTML(
      'beforeend',
      aiEndpointPanel()
    );
  }

  if(
    current==='clientes' ||
    current==='produtos' ||
    current==='servicos' ||
    current==='pedidos' ||
    current==='documentos'
  ){

    renderTableRows();
  }

  if(current==='financeiro'){

    root
      .querySelectorAll(
        'button[data-action="delete"][data-id]'
      )
      .forEach(btn => {

        const pdf =
          document.createElement('button');

        pdf.className =
          'button soft small';

        pdf.textContent =
          'PDF';

        pdf.dataset.action =
          'pdf';

        pdf.dataset.type =
          'lancamentos';

        pdf.dataset.id =
          btn.dataset.id;

        btn.parentElement
          .prepend(pdf);
      });
  }
}

function header(
  title,
  sub,
  entity,
  button='Novo registro'
){

  const control =
    entity==='relatorios'

      ? `
        <button
          class="button soft small"
          data-action="pdf"
          data-type="relatorios"
        >
          Baixar PDF
        </button>

        <button
          class="button primary"
          data-action="export"
        >
          Exportar dados
        </button>
      `

      : entity==='configuracoes'

      ? ''

      : entity==='agenda' ||
        entity==='financeiro'

      ? `
        <button
          class="button soft small"
          data-action="pdf"
          data-type="${entity}"
        >
          Baixar PDF
        </button>

        <button
          class="button primary"
          data-action="new"
          data-type="${entity}"
        >
          ＋ ${button}
        </button>
      `

      : `
        <button
          class="button primary"
          data-action="new"
          data-type="${entity}"
        >
          ＋ ${button}
        </button>
      `;

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">
          TEIXEIRA · GESTÃO
        </div>

        <h1>${title}</h1>

        <p>${sub}</p>
      </div>

      <div class="head-actions">
        ${control}
      </div>
    </div>
  `;
}

function homeTiles(){

  const tiles = [
    [
      'pedidos',
      '▤',
      'Pedidos',
      'Criar e acompanhar vendas'
    ],
    [
      'agenda',
      '▦',
      'Agenda',
      'Compromissos e lembretes'
    ],
    [
      'financeiro',
      '＄',
      'Financeiro',
      'Receitas, despesas e saldo'
    ],
    [
      'clientes',
      '♙',
      'Clientes',
      'Contatos e histórico'
    ],
    [
      'produtos',
      '◇',
      'Peças & estoque',
      'Produtos e movimentações'
    ],
    [
      'servicos',
      '✳',
      'Serviços',
      'Seu catálogo de serviços'
    ]
  ];

  return `
    <section class="home-modules">

      <div class="module-grid">

        ${tiles.map(
          ([page,icon,title,desc]) => `
            <button
              class="module-tile"
              data-action="open"
              data-page="${page}"
            >
              <span class="module-icon">
                ${icon}
              </span>

              <strong>${title}</strong>

              <small>${desc}</small>
            </button>
          `
        ).join('')}

      </div>

      <div class="shortcut-heading">
        <strong>ATALHOS</strong>

        <button
          class="icon-button"
          data-action="open"
          data-page="configuracoes"
          aria-label="Personalizar atalhos"
        >
          ☷
        </button>
      </div>

      <div class="shortcut-grid">

        <button
          class="shortcut"
          data-action="new"
          data-type="pedidos"
        >
          <span>▤</span>
          Criar novo pedido
        </button>

        <button
          class="shortcut"
          data-action="new"
          data-type="financeiro"
        >
          <span>＄</span>
          Novo recebimento
        </button>

        <button
          class="shortcut"
          data-action="new"
          data-type="agenda"
        >
          <span>▦</span>
          Novo compromisso
        </button>

        <button
          class="shortcut"
          data-action="new"
          data-type="financeiro"
        >
          <span>−</span>
          Novo custo
        </button>

        <button
          class="shortcut"
          data-action="new"
          data-type="documentos"
        >
          <span>▧</span>
          Novo orçamento
        </button>

      </div>

      <section class="summary-note panel">

        <div>
          <strong>RESUMO</strong>

          <p>
            ${esc(
              db.config.resumo ||
              'Adicione uma anotação ou lembrete importante do seu dia.'
            )}
          </p>
        </div>

        <button
          class="round-add"
          data-action="note"
        >
          ＋
        </button>

      </section>

      <button
        class="home-primary"
        data-action="new"
        data-type="pedidos"
      >
        ▤ &nbsp; Criar novo pedido
      </button>

    </section>
  `;
}

function calcSummary(){

  const receitas =
    db.lancamentos
      .filter(
        x =>
          x.tipo==='receita' &&
          ![
            'A receber',
            'Atrasado'
          ].includes(x.status)
      )
      .reduce(
        (a,x) =>
          a + Number(x.valor),
        0
      );

  const despesas =
    db.lancamentos
      .filter(
        x => x.tipo==='despesa'
      )
      .reduce(
        (a,x) =>
          a + Number(x.valor),
        0
      );

  const pend =
    db.pedidos
      .filter(
        x => x.status==='Pendente'
      )
      .reduce(
        (a,x) =>
          a + Number(x.total),
        0
      )
      +
      db.lancamentos
        .filter(
          x =>
            x.tipo==='receita' &&
            [
              'A receber',
              'Atrasado'
            ].includes(x.status)
        )
        .reduce(
          (a,x) =>
            a + Number(x.valor),
          0
        );

  return {
    receitas,
    despesas,
    pend,
    saldo:
      receitas-despesas
  };
}

function dashboard(){

  const s =
    calcSummary();

  const todays =
    db.agenda
      .filter(
        x => x.data===todayISO()
      )
      .sort(
        (a,b) =>
          a.hora.localeCompare(b.hora)
      );

  return `
    <div class="page-head">

      <div>
        <div class="eyebrow">
          ${new Intl.DateTimeFormat(
            'pt-BR',
            {
              weekday:'long',
              day:'numeric',
              month:'long'
            }
          ).format(new Date()).toUpperCase()}
          · TEIXEIRA
        </div>

        <h1>Bom dia 👋</h1>

        <p>
          Uma visão clara do que acontece no seu negócio.
        </p>
      </div>

      <button
        class="button primary"
        data-action="new"
        data-type="pedidos"
      >
        ＋ Novo pedido
      </button>

    </div>

    <div class="dashboard-grid">

      <section class="panel welcome-card">

        <div class="eyebrow">
          SEU NEGÓCIO, EM BOAS MÃOS
        </div>

        <h2>
          Organize. Atenda. Cresça.
        </h2>

        <p>
          Cuide dos clientes e acompanhe cada detalhe
          em um só lugar.
        </p>

        <button
          class="button gold"
          data-action="open"
          data-page="agenda"
        >
          Ver minha agenda&nbsp; ↗
        </button>

      </section>

      <div class="summary-grid">

        <div class="panel metric">
          <div class="metric-top">
            Recebido no período
            <span class="metric-icon">↗</span>
          </div>

          <strong>
            ${money(s.receitas)}
          </strong>
        </div>

        <div class="panel metric">
          <div class="metric-top">
            A receber
            <span class="metric-icon">◷</span>
          </div>

          <strong>
            ${money(s.pend)}
          </strong>
        </div>

        <div class="panel metric">
          <div class="metric-top">
            Despesas
            <span class="metric-icon">↘</span>
          </div>

          <strong>
            ${money(s.despesas)}
          </strong>
        </div>

        <div class="panel metric">
          <div class="metric-top">
            Clientes
            <span class="metric-icon">♙</span>
          </div>

          <strong>
            ${db.clientes.length}
            <small>cadastrados</small>
          </strong>
        </div>

      </div>

    </div>

    <div class="lower-grid">

      <section class="panel">

        <div class="panel-head">
          <h3>Agenda de hoje</h3>

          <a
            data-action="open"
            data-page="agenda"
          >
            Ver agenda →
          </a>
        </div>

        <div class="agenda-list">

          ${
            todays.length

            ? todays
              .slice(0,4)
              .map(
                x => `
                  <div class="agenda-row">

                    <div class="agenda-time">
                      ${esc(x.hora)}
                    </div>

                    <div class="agenda-bar"></div>

                    <div class="agenda-desc">
                      <strong>
                        ${esc(x.titulo)}
                      </strong>

                      <span>
                        ${esc(
                          x.cliente ||
                          'Sem cliente vinculado'
                        )}
                      </span>
                    </div>

                    <span
                      class="status ${x.status==='Pendente'?'pending':''}"
                    >
                      ${esc(x.status)}
                    </span>

                  </div>
                `
              )
              .join('')

            : `
              <div class="empty-state">

                <span>▦</span>

                <h3>
                  Dia livre por enquanto
                </h3>

                <p>
                  Adicione um compromisso à sua agenda.
                </p>

                <button
                  class="button soft small"
                  data-action="new"
                  data-type="agenda"
                >
                  ＋ Novo compromisso
                </button>

              </div>
            `
          }

        </div>

      </section>

      <section class="panel activity-panel">

        <div class="panel-head">

          <h3>Atividade recente</h3>

          <a
            data-action="open"
            data-page="pedidos"
          >
            Ver pedidos →
          </a>

        </div>

        <div class="activity-list">

          ${
            db.pedidos
              .slice(0,3)
              .map(
                o => `
                  <div class="activity">

                    <div class="activity-dot">
                      ▤
                    </div>

                    <div>
                      <strong>
                        ${esc(o.numero)}
                        ·
                        ${esc(o.cliente)}
                      </strong>

                      <span>
                        ${esc(o.status)}
                        ·
                        ${money(o.total)}
                      </span>
                    </div>

                  </div>
                `
              )
              .join('')

            ||
            `
              <div class="empty-state">
                <p>
                  Nenhuma atividade ainda.
                </p>
              </div>
            `
          }

        </div>

      </section>

    </div>

    <div class="quick-grid">

      <button
        class="quick-action"
        data-action="new"
        data-type="clientes"
      >
        <span>♙</span>
        <strong>Cadastrar cliente</strong>
      </button>

      <button
        class="quick-action"
        data-action="new"
        data-type="agenda"
      >
        <span>▦</span>
        <strong>Agendar horário</strong>
      </button>

      <button
        class="quick-action"
        data-action="new"
        data-type="financeiro"
      >
        <span>＄</span>
        <strong>Lançar despesa</strong>
      </button>

      <button
        class="quick-action"
        data-action="new"
        data-type="documentos"
      >
        <span>▧</span>
        <strong>Criar orçamento</strong>
      </button>

    </div>
  `;
}

/* =========================================================
   LISTAS
========================================================= */

const META = {
  clientes:{
    title:'Clientes',
    sub:'Seus relacionamentos e histórico em um só lugar.',
    icon:'♙',
    button:'Cadastrar cliente'
  },

  produtos:{
    title:'Produtos',
    sub:'Catálogo, preços e controle de estoque.',
    icon:'◇',
    button:'Novo produto'
  },

  servicos:{
    title:'Serviços',
    sub:'Organize seu catálogo de serviços.',
    icon:'✳',
    button:'Novo serviço'
  },

  pedidos:{
    title:'Pedidos',
    sub:'Acompanhe cada venda do início à conclusão.',
    icon:'▤',
    button:'Novo pedido'
  },

  documentos:{
    title:'Documentos',
    sub:'Orçamentos, propostas e documentos do negócio.',
    icon:'▧',
    button:'Novo documento'
  }
};

function listPage(type){

  const m =
    META[type];

  return `
    ${header(
      m.title,
      m.sub,
      type,
      m.button
    )}

    ${
      type==='pedidos'
      ?
      `
        <div class="order-tabs">

          <button
            class="${orderListTab==='todos'?'active':''}"
            data-action="order-tab"
            data-tab="todos"
          >
            Todos os pedidos
            <span>${db.pedidos.length}</span>
          </button>

          <button
            class="${orderListTab==='receber'?'active':''}"
            data-action="order-tab"
            data-tab="receber"
          >
            Parcelas por receber
            <span>
              ${
                db.pedidos.filter(
                  x => x.status==='Pendente'
                ).length
              }
            </span>
          </button>

        </div>
      `
      :
      ''
    }

    <div class="toolbar">

      <label class="search-box">

        <span>⌕</span>

        <input
          data-filter
          placeholder="Buscar ${m.title.toLowerCase()}..."
          value="${esc(searchTerm)}"
        >

      </label>

      ${
        type==='pedidos'
        ?
        `
          <select
            class="filter-select"
            id="status-filter"
            onchange="renderTableRows()"
          >
            <option value="">
              Todos os status
            </option>

            <option>Pendente</option>
            <option>Aprovado</option>
            <option>Concluído</option>
          </select>
        `
        :
        ''
      }

    </div>

    <section class="panel table-panel">

      <div class="table-wrap">

        <table class="data-table">

          <thead>
            ${tableHead(type)}
          </thead>

          <tbody id="table-body"></tbody>

        </table>

      </div>

    </section>
  `;
}

function tableHead(type){

  if(type==='clientes'){
    return `
      <tr>
        <th>Cliente</th>
        <th>Contato</th>
        <th>Local</th>
        <th>Histórico</th>
        <th></th>
      </tr>
    `;
  }

  if(type==='produtos'){
    return `
      <tr>
        <th>Produto</th>
        <th>Código</th>
        <th>Categoria</th>
        <th>Preço</th>
        <th>Estoque</th>
        <th></th>
      </tr>
    `;
  }

  if(type==='servicos'){
    return `
      <tr>
        <th>Serviço</th>
        <th>Categoria</th>
        <th>Descrição</th>
        <th>Preço</th>
        <th></th>
      </tr>
    `;
  }

  if(type==='pedidos'){
    return `
      <tr>
        <th>Pedido</th>
        <th>Cliente</th>
        <th>Data</th>
        <th>Total</th>
        <th>Status</th>
        <th></th>
      </tr>
    `;
  }

  return `
    <tr>
      <th>Documento</th>
      <th>Cliente</th>
      <th>Data</th>
      <th>Valor</th>
      <th>Status</th>
      <th></th>
    </tr>
  `;
}

function filtered(type){

  const list =
    type==='documentos'
      ? db.documentos
      : db[type] || [];

  const q =
    searchTerm;

  return list.filter(
    x =>
      !q ||
      Object.values(x)
        .join(' ')
        .toLowerCase()
        .includes(q)
  );
}

function tableRows(type){

  return filtered(type)
    .map(x => {

      const action = `
        <div class="row-actions">

          ${
            type==='clientes'
            ?
            `
              <button
                data-action="whatsapp"
                data-type="${type}"
                data-id="${x.id}"
              >
                WhatsApp
              </button>

              <button
                data-action="view-client"
                data-id="${x.id}"
              >
                Histórico
              </button>

              <button
                data-action="pdf"
                data-type="${type}"
                data-id="${x.id}"
              >
                PDF
              </button>
            `
            :
            ''
          }

          ${
            type==='produtos'
            ?
            `
              <button
                data-action="stock"
                data-kind="entrada"
                data-id="${x.id}"
              >
                Entrada
              </button>

              <button
                data-action="stock"
                data-kind="saida"
                data-id="${x.id}"
              >
                Saída
              </button>
            `
            :
            ''
          }

          ${
            type==='documentos' &&
            x.tipo==='Orçamento'
            ?
            `
              <button
                data-action="convert"
                data-id="${x.id}"
              >
                Virar pedido
              </button>
            `
            :
            ''
          }

          ${
            type==='pedidos' ||
            type==='documentos'
            ?
            `
              <button
                data-action="pdf"
                data-type="${type}"
                data-id="${x.id}"
              >
                Baixar PDF
              </button>
            `
            :
            ''
          }

          <button
            data-action="edit"
            data-type="${type}"
            data-id="${x.id}"
            aria-label="Editar"
          >
            Editar
          </button>

          <button
            data-action="delete"
            data-type="${type}"
            data-id="${x.id}"
            aria-label="Excluir"
          >
            Excluir
          </button>

        </div>
      `;

      if(type==='clientes'){

        return `
          <tr>

            <td>
              <div class="person-cell">

                <span class="person-avatar">
                  ${initials(x.nome)}
                </span>

                <span>
                  <strong>
                    ${esc(x.nome)}
                  </strong>

                  <small>
                    ${esc(
                      x.email ||
                      'Sem e-mail'
                    )}
                  </small>
                </span>

              </div>
            </td>

            <td>
              ${esc(x.telefone || '—')}
            </td>

            <td>
              ${esc(
                x.cidade ||
                x.endereco ||
                '—'
              )}
            </td>

            <td>
              ${
                db.pedidos.filter(
                  o => o.cliente===x.nome
                ).length
              }
              pedidos
            </td>

            <td>
              ${action}
            </td>

          </tr>
        `;
      }

      if(type==='produtos'){

        return `
          <tr>

            <td>
              <div class="person-cell">

                <span class="person-avatar">
                  ◇
                </span>

                <strong>
                  ${esc(x.nome)}
                </strong>

              </div>
            </td>

            <td>
              ${esc(x.codigo || '—')}

              <small
                style="
                  display:block;
                  color:#aaa;
                  margin-top:3px
                "
              >
                ${esc(x.barcode || '')}
              </small>
            </td>

            <td>
              ${esc(x.categoria || '—')}
            </td>

            <td>
              ${money(x.preco)}
            </td>

            <td>
              ${x.estoque ?? 0} un.
            </td>

            <td>
              ${action}
            </td>

          </tr>
        `;
      }

      if(type==='servicos'){

        return `
          <tr>

            <td>
              <strong>
                ${esc(x.nome)}
              </strong>
            </td>

            <td>
              ${esc(x.categoria || '—')}
            </td>

            <td>
              ${esc(x.descricao || '—')}
            </td>

            <td>
              ${money(x.preco)}
            </td>

            <td>
              ${action}
            </td>

          </tr>
        `;
      }

      if(type==='pedidos'){

        return `
          <tr>

            <td>

              <strong>
                ${esc(x.numero)}
              </strong>

              <small
                style="
                  display:block;
                  color:#999;
                  margin-top:4px
                "
              >
                ${esc(x.descricao || '')}
              </small>

            </td>

            <td>
              ${esc(x.cliente || '—')}
            </td>

            <td>
              ${formatDate(x.data)}
            </td>

            <td>
              <strong>
                ${money(x.total)}
              </strong>
            </td>

            <td>
              <span
                class="status ${
                  x.status==='Pendente'
                    ? 'pending'
                    : ''
                }"
              >
                ${esc(x.status)}
              </span>
            </td>

            <td>
              ${action}
            </td>

          </tr>
        `;
      }

      return `
        <tr>

          <td>

            <strong>
              ${esc(x.tipo)}
              ·
              ${esc(x.numero || '')}
            </strong>

            <small
              style="
                display:block;
                color:#999;
                margin-top:4px
              "
            >
              ${esc(x.descricao || '')}
            </small>

          </td>

          <td>
            ${esc(x.cliente || '—')}
          </td>

          <td>
            ${formatDate(x.data)}
          </td>

          <td>
            ${money(x.total)}
          </td>

          <td>

            <span
              class="status ${
                x.status==='Pendente'
                  ? 'pending'
                  : ''
              }"
            >
              ${esc(
                x.status ||
                'Rascunho'
              )}
            </span>

          </td>

          <td>
            ${action}
          </td>

        </tr>
      `;
    })
    .join('');
}

function renderTableRows(){

  const body =
    $('#table-body');

  if(!body) return;

  const type =
    current;

  const rows =
    tableRows(type);

  let selected =
    rows;

  if(
    type==='pedidos' &&
    orderListTab==='receber'
  ){

    const temp =
      document.createElement('tbody');

    temp.innerHTML =
      rows;

    selected =
      [
        ...temp.rows
      ]
      .filter(
        row =>
          row
            .querySelector('.status')
            ?.textContent
            .trim()==='Pendente'
      )
      .map(
        row => row.outerHTML
      )
      .join('');
  }

  body.innerHTML =
    selected ||
    `
      <tr>

        <td colspan="6">

          <div class="empty-state">

            <span>
              ${META[type].icon}
            </span>

            <h3>
              Nenhum registro por aqui
            </h3>

            <p>
              Comece adicionando seu primeiro
              ${META[type].title
                .toLowerCase()
                .replace(/s$/,'')}.
            </p>

            <button
              class="button soft small"
              data-action="new"
              data-type="${type}"
            >
              ＋ ${META[type].button}
            </button>

          </div>

        </td>

      </tr>
    `;

  if(type==='pedidos'){

    body
      .querySelectorAll('tr')
      .forEach(row => {

        const num =
          row
            .querySelector('td strong')
            ?.textContent;

        const order =
          db.pedidos.find(
            x => x.numero===num
          );

        if(order){

          const cell =
            row.lastElementChild;

          const button =
            document.createElement('button');

          button.textContent =
            'Detalhes';

          button.dataset.action =
            'detail';

          button.dataset.id =
            order.id;

          cell.prepend(button);
        }
      });
  }

  const sf =
    $('#status-filter');

  if(sf){

    const val =
      sf.value;

    for(
      const row of
      body.querySelectorAll('tr')
    ){

      row.hidden =
        !!val &&
        !row.innerText.includes(val);
    }
  }
}

function formatDate(v){

  if(!v) return '—';

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day:'2-digit',
      month:'short'
    }
  ).format(
    new Date(`${v}T12:00:00`)
  );
}

/* =========================================================
   AGENDA
========================================================= */

function agendaPage(){

  const year =
    monthCursor.getFullYear();

  const month =
    monthCursor.getMonth();

  const first =
    new Date(
      year,
      month,
      1
    );

  const start =
    (first.getDay()+6)%7;

  const days =
    new Date(
      year,
      month+1,
      0
    ).getDate();

  const prevDays =
    new Date(
      year,
      month,
      0
    ).getDate();

  const monthName =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        month:'long',
        year:'numeric'
      }
    ).format(
      monthCursor
    );

  let cells = '';

  for(
    let i=0;
    i<42;
    i++
  ){

    let n =
      i-start+1;

    let muted =
      false;

    let date;

    if(n<1){

      n =
        prevDays+n;

      muted =
        true;

      date =
        new Date(
          year,
          month-1,
          n
        );

    }else if(n>days){

      n -= days;

      muted =
        true;

      date =
        new Date(
          year,
          month+1,
          n
        );

    }else{

      date =
        new Date(
          year,
          month,
          n
        );
    }

    const iso =
      `${date.getFullYear()}-${String(
        date.getMonth()+1
      ).padStart(2,'0')}-${String(
        date.getDate()
      ).padStart(2,'0')}`;

    const eventCount =
      db.agenda.filter(
        a => a.data===iso
      ).length;

    const has =
      eventCount>0;

    const today =
      iso===todayISO();

    cells += `
      <button
        class="calendar-day ${
          muted ? 'muted' : ''
        } ${
          has ? 'has-event' : ''
        } ${
          iso===agendaSelected
            ? 'selected'
            : ''
        } ${
          today ? 'today' : ''
        }"
        data-action="select-day"
        data-date="${iso}"
        title="${
          has
            ? `${eventCount} compromisso${eventCount>1?'s':''}`
            : 'Nenhum compromisso'
        }"
        aria-label="${
          `${n} de ${monthName}: ${
            has
              ? `${eventCount} compromisso${eventCount>1?'s':''}`
              : 'nenhum compromisso'
          }`
        }"
      >
        <span class="calendar-day-number">${n}</span>
        ${
          has
            ? `<span class="calendar-event-count">${eventCount}</span>`
            : ''
        }
      </button>
    `;
  }

  const dayItems =
    db.agenda
      .filter(
        x => x.data===agendaSelected
      )
      .sort(
        (a,b) =>
          a.hora.localeCompare(b.hora)
      );

  return `
    ${header(
      'Agenda',
      'Seus compromissos organizados com leveza.',
      'agenda',
      'Novo compromisso'
    )}

    <div class="calendar-layout">

      <section class="panel calendar-panel">

        <div class="calendar-title">

          <button
            data-action="month-prev"
          >
            ‹
          </button>

          <strong>
            ${monthName}
          </strong>

          <button
            data-action="month-next"
          >
            ›
          </button>

        </div>

        <div class="calendar-grid">

          ${
            [
              'SEG',
              'TER',
              'QUA',
              'QUI',
              'SEX',
              'SÁB',
              'DOM'
            ]
            .map(
              x =>
                `<div class="weekday">${x}</div>`
            )
            .join('')
          }

          ${cells}

        </div>

      </section>

      <section class="panel side-agenda">

        <h3>
          Compromissos ·
          ${formatDate(agendaSelected)}
        </h3>

        ${
          dayItems.length

          ?

          dayItems
            .map(
              x => `
                <div class="agenda-mini">

                  <b>
                    ${esc(x.hora)}
                    ·
                    ${esc(x.titulo)}
                  </b>

                  <span>
                    ${esc(
                      x.cliente ||
                      'Sem cliente'
                    )}
                  </span>

                  <div
                    class="row-actions"
                    style="
                      justify-content:flex-start;
                      margin-top:8px
                    "
                  >

                    <button
                      data-action="edit"
                      data-type="agenda"
                      data-id="${x.id}"
                    >
                      Editar
                    </button>

                    <button
                      data-action="delete"
                      data-type="agenda"
                      data-id="${x.id}"
                    >
                      Excluir
                    </button>

                  </div>

                </div>
              `
            )
            .join('')

          :

          `
            <p
              style="
                font-size:10px;
                color:#968e87
              "
            >
              Nenhum compromisso neste dia.
              Selecione outra data ou adicione um novo.
            </p>
          `
        }

        <button
          class="button soft small"
          style="margin-top:14px;width:100%"
          data-action="new"
          data-type="agenda"
        >
          ＋ Adicionar à agenda
        </button>

      </section>

    </div>
  `;
}

/* =========================================================
   FINANCEIRO
========================================================= */

function financePage(){

  const s =
    calcSummary();

  const items =
    [...db.lancamentos]
      .sort(
        (a,b) =>
          b.data.localeCompare(a.data)
      );

  return `
    ${header(
      'Financeiro',
      'Receitas, despesas e resultado do seu negócio.',
      'financeiro',
      'Novo lançamento'
    )}

    <section class="panel finance-banner">

      <div>

        <div class="eyebrow">
          SALDO DO PERÍODO
        </div>

        <h2>
          ${money(s.saldo)}
        </h2>

        <p>
          Atualizado com base nos lançamentos registrados
        </p>

      </div>

      <button
        class="button gold"
        data-action="new"
        data-type="financeiro"
      >
        ＋ Lançar receita ou despesa
      </button>

    </section>

    <div class="finance-items">

      <div class="panel finance-card">
        <span>Recebido</span>
        <strong style="color:var(--green)">
          ${money(s.receitas)}
        </strong>
      </div>

      <div class="panel finance-card">
        <span>
          A receber · pedidos pendentes
        </span>

        <strong>
          ${money(s.pend)}
        </strong>
      </div>

      <div class="panel finance-card">
        <span>Despesas</span>

        <strong style="color:var(--red)">
          ${money(s.despesas)}
        </strong>
      </div>

    </div>

    <section
      class="panel"
      style="margin-top:15px"
    >

      <div class="panel-head">

        <h3>
          Lançamentos recentes
        </h3>

        <a
          data-action="new"
          data-type="financeiro"
        >
          ＋ Adicionar
        </a>

      </div>

      <div class="table-wrap">

        <table class="data-table">

          <thead>

            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Data</th>
              <th>Forma</th>
              <th>Valor</th>
              <th></th>
            </tr>

          </thead>

          <tbody>

            ${
              items
                .map(
                  x => `
                    <tr>

                      <td>

                        <strong>
                          ${esc(x.descricao)}
                        </strong>

                        ${
                          x.cliente
                          ?
                          `
                            <small
                              style="
                                display:block;
                                color:#999;
                                margin-top:3px
                              "
                            >
                              ${esc(x.cliente)}
                            </small>
                          `
                          :
                          ''
                        }

                      </td>

                      <td>
                        ${esc(x.categoria || '—')}
                      </td>

                      <td>
                        ${formatDate(x.data)}
                      </td>

                      <td>
                        ${esc(x.forma || '—')}
                      </td>

                      <td
                        style="
                          color:${
                            x.tipo==='receita'
                              ? 'var(--green)'
                              : 'var(--red)'
                          };
                          font-weight:700
                        "
                      >
                        ${
                          x.tipo==='receita'
                            ? '+'
                            : '−'
                        }
                        ${money(x.valor)}
                      </td>

                      <td>

                        <div class="row-actions">

                          <button
                            data-action="duplicate"
                            data-type="lancamentos"
                            data-id="${x.id}"
                          >
                            Duplicar
                          </button>

                          <button
                            data-action="delete"
                            data-type="lancamentos"
                            data-id="${x.id}"
                          >
                            Excluir
                          </button>

                        </div>

                      </td>

                    </tr>
                  `
                )
                .join('')

              ||

              `
                <tr>
                  <td colspan="6">
                    Nenhum lançamento ainda.
                  </td>
                </tr>
              `
            }

          </tbody>

        </table>

      </div>

    </section>
  `;
}

/* =========================================================
   RELATÓRIOS
========================================================= */

function reportsPage(){

  const s =
    calcSummary();

  const vals =
    [
      44,57,38,72,
      59,86,66,91,
      52,74,68,96
    ];

  return `
    ${header(
      'Relatórios',
      'Acompanhe a evolução e tome decisões com confiança.',
      'relatorios',
      'Exportar resumo'
    )}

    <div class="finance-items">

      <div class="panel finance-card">

        <span>
          Faturamento registrado
        </span>

        <strong>
          ${money(s.receitas)}
        </strong>

      </div>

      <div class="panel finance-card">

        <span>
          Resultado
        </span>

        <strong>
          ${money(s.saldo)}
        </strong>

      </div>

      <div class="panel finance-card">

        <span>
          Ticket médio de pedidos
        </span>

        <strong>
          ${
            money(
              db.pedidos.length
              ?
              db.pedidos.reduce(
                (a,x) =>
                  a+Number(x.total),
                0
              ) /
              db.pedidos.length
              :
              0
            )
          }
        </strong>

      </div>

    </div>

    <section
      class="panel"
      style="margin-top:15px"
    >

      <div class="panel-head">

        <h3>
          Movimento financeiro · visão mensal
        </h3>

        <span class="text-link">
          Últimos 12 meses
        </span>

      </div>

      <div class="chart-box">

        <div class="bars">

          ${
            vals.map(
              (v,i) => `
                <div class="bar-group">

                  <div
                    class="bar"
                    style="height:${v}%"
                  ></div>

                  <div
                    class="bar expense"
                    style="height:${Math.max(
                      8,
                      v*.42
                    )}%"
                  ></div>

                </div>
              `
            ).join('')
          }

        </div>

        <div class="bar-labels">

          ${
            [
              'OUT','NOV','DEZ',
              'JAN','FEV','MAR',
              'ABR','MAI','JUN',
              'JUL','AGO','SET'
            ]
            .map(
              x =>
                `<span>${x}</span>`
            )
            .join('')
          }

        </div>

      </div>

      <div
        style="
          padding:0 20px 18px;
          font-size:9px;
          color:#8f8881
        "
      >
        ▰ Receitas &nbsp;&nbsp;
        ▰ Despesas &nbsp; ·
        Os gráficos serão detalhados conforme você
        registra seus lançamentos.
      </div>

    </section>

    <section
      class="panel"
      style="margin-top:15px"
    >

      <div class="panel-head">
        <h3>Seus destaques</h3>
      </div>

      <div class="activity-list">

        <div class="activity">

          <div class="activity-dot">
            ♙
          </div>

          <div>
            <strong>
              ${db.clientes.length}
              clientes cadastrados
            </strong>

            <span>
              Relacionamentos ativos na sua base
            </span>
          </div>

        </div>

        <div class="activity">

          <div class="activity-dot">
            ▤
          </div>

          <div>

            <strong>
              ${db.pedidos.length}
              pedidos registrados
            </strong>

            <span>
              ${
                db.pedidos.filter(
                  x => x.status==='Pendente'
                ).length
              }
              aguardando aprovação ou pagamento
            </span>

          </div>

        </div>

      </div>

    </section>
  `;
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

function settingsPage(){

  const c =
    db.config || {};

  return `
    ${header(
      'Configurações',
      'Deixe o espaço de trabalho com a sua cara.',
      'configuracoes'
    )}

    <form
      id="settings-form"
      class="panel modal-form"
      style="max-width:650px"
    >

      <div class="form-grid">

        <div class="field full">

          <label>
            Nome da empresa
          </label>

          <input
            name="empresa"
            value="${esc(
              c.empresa || 'Teixeira'
            )}"
          >

        </div>

        <div class="field">

          <label>
            Telefone / WhatsApp
          </label>

          <input
            name="telefone"
            value="${esc(c.telefone || '')}"
            placeholder="(00) 00000-0000"
          >

        </div>

        <div class="field">

          <label>
            E-mail
          </label>

          <input
            name="email"
            type="email"
            value="${esc(c.email || '')}"
          >

        </div>

        <div class="field full">

          <label>
            Endereço
          </label>

          <input
            name="endereco"
            value="${esc(c.endereco || '')}"
          >

        </div>

        <div class="field">

          <label>
            Moeda
          </label>

          <select name="moeda">

            <option
              value="BRL"
              ${
                c.moeda==='BRL'
                  ? 'selected'
                  : ''
              }
            >
              Real brasileiro · R$
            </option>

            <option
              value="USD"
              ${
                c.moeda==='USD'
                  ? 'selected'
                  : ''
              }
            >
              Dólar · US$
            </option>

            <option
              value="EUR"
              ${
                c.moeda==='EUR'
                  ? 'selected'
                  : ''
              }
            >
              Euro · €
            </option>

          </select>

        </div>

        <div class="field">

          <label>
            Logo
          </label>

          <div
            style="
              display:flex;
              align-items:center;
              gap:9px
            "
          >

            <img
              src="./LOGO.jpg"
              alt="Logo Teixeira"
              style="
                width:110px;
                height:35px;
                object-fit:contain;
                border:1px solid var(--line);
                border-radius:6px;
                padding:4px
              "
            >

            <span
              style="
                font-size:9px;
                color:#968e87
              "
            >
              Sua marca aplicada ao app
            </span>

          </div>

        </div>

      </div>

      <div class="form-actions">

        <button
          class="button primary"
          type="submit"
        >
          Salvar configurações
        </button>

      </div>

      <div
        style="
          font-size:10px;
          color:#968e87;
          margin-top:15px;
          border-top:1px solid var(--line);
          padding-top:14px
        "
      >
        Seus dados são sincronizados com o Supabase
        quando a conexão com a nuvem está disponível.
        O navegador mantém também um cache local
        para permitir o funcionamento mesmo em caso
        de instabilidade.
      </div>

    </form>

    <section
      class="panel"
      style="
        max-width:650px;
        margin-top:15px;
        padding:17px 20px
      "
    >

      <h3
        style="
          font:700 12px Manrope;
          margin:0 0 8px
        "
      >
        Seus dados
      </h3>

      <p
        style="
          font-size:10px;
          color:#8f8881;
          margin:0 0 13px
        "
      >
        Faça uma cópia dos registros deste navegador
        ou restaure um backup JSON.
      </p>

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap
        "
      >

        <button
          class="button soft small"
          data-action="backup"
        >
          Baixar backup
        </button>

        <label
          class="button soft small"
          for="restore-file"
        >
          Restaurar backup
        </label>

        <input
          id="restore-file"
          type="file"
          accept="application/json"
          hidden
        >

      </div>

    </section>
  `;
}

function entityForPage(){

  return current==='financeiro'
    ? 'financeiro'
    : current;
}

/* =========================================================
   CAMPOS
========================================================= */

const FIELDS = {

  clientes:[
    [
      'nome',
      'Nome completo',
      'text',
      true
    ],
    [
      'telefone',
      'Telefone',
      'tel'
    ],
    [
      'whatsapp',
      'WhatsApp',
      'tel'
    ],
    [
      'email',
      'E-mail',
      'email'
    ],
    [
      'cpf',
      'CPF / CNPJ',
      'text'
    ],
    [
      'endereco',
      'Endereço',
      'text'
    ],
    [
      'cidade',
      'Cidade',
      'text'
    ],
    [
      'observacoes',
      'Observações',
      'textarea'
    ]
  ],

  produtos:[
    [
      'nome',
      'Nome do produto',
      'text',
      true
    ],
    [
      'descricao',
      'Descrição',
      'textarea'
    ],
    [
      'codigo',
      'Código interno',
      'text'
    ],
    [
      'barcode',
      'Código de barras',
      'text'
    ],
    [
      'categoria',
      'Categoria',
      'text'
    ],
    [
      'preco',
      'Preço de venda',
      'number'
    ],
    [
      'custo',
      'Custo',
      'number'
    ],
    [
      'estoque',
      'Estoque atual',
      'number'
    ]
  ],

  servicos:[
    [
      'nome',
      'Nome do serviço',
      'text',
      true
    ],
    [
      'descricao',
      'Descrição',
      'textarea'
    ],
    [
      'categoria',
      'Categoria',
      'text'
    ],
    [
      'preco',
      'Preço',
      'number'
    ]
  ],

  pedidos:[
    [
      'cliente',
      'Cliente',
      'client'
    ],
    [
      'descricao',
      'Produtos ou serviços',
      'textarea',
      true
    ],
    [
      'quantidade',
      'Quantidade',
      'number'
    ],
    [
      'desconto',
      'Desconto (R$)',
      'number'
    ],
    [
      'total',
      'Valor total (R$)',
      'number',
      true
    ],
    [
      'forma',
      'Forma de pagamento',
      'select:Pix|Cartão|Credito|Debito|Dinheiro|Transferência|Boleto'
    ],
    [
      'condicao',
      'Condição de pagamento',
      'select:À vista|Parcelado|A combinar'
    ],
    [
      'parcelas',
      'Número de parcelas',
      'number'
    ],
    [
      'status',
      'Status do pedido',
      'select:Pendente|Aprovado|Concluído|Cancelado'
    ],
    [
      'data',
      'Data do pedido',
      'date'
    ]
  ],

  agenda:[
    [
      'titulo',
      'Compromisso / serviço',
      'text',
      true
    ],
    [
      'cliente',
      'Cliente',
      'client'
    ],
    [
      'data',
      'Data',
      'date',
      true
    ],
    [
      'hora',
      'Horário',
      'time',
      true
    ],
    [
      'status',
      'Status',
      'select:Confirmado|Pendente|Concluído|Cancelado'
    ],
    [
      'obs',
      'Observação',
      'textarea'
    ]
  ],

  financeiro:[
    [
      'tipo',
      'Tipo de lançamento',
      'select:Receita|Despesa',
      true
    ],
    [
      'descricao',
      'Descrição',
      'text',
      true
    ],
    [
      'cliente',
      'Cliente',
      'client'
    ],
    [
      'categoria',
      'Categoria',
      'text'
    ],
    [
      'valor',
      'Valor (R$)',
      'number',
      true
    ],
    [
      'data',
      'Data',
      'date',
      true
    ],
    [
      'forma',
      'Forma de pagamento',
      'select:Pix|Cartão|Dinheiro|Transferência|Boleto'
    ]
  ],

  documentos:[
    [
      'tipo',
      'Tipo de documento',
      'select:Orçamento|Ordem de serviço|Recibo|Contrato|Proposta comercial|Proposta de investimento|Laudo técnico|Relatório de higienização|Termos e condições|Garantia',
      true
    ],
    [
      'cliente',
      'Cliente',
      'client'
    ],
    [
      'descricao',
      'Descrição / itens',
      'textarea',
      true
    ],
    [
      'total',
      'Valor (R$)',
      'number'
    ],
    [
      'validade',
      'Validade',
      'date'
    ],
    [
      'observacoes',
      'Observações',
      'textarea'
    ]
  ]
};

const EXTRA_FIELDS = {

  pedidos:[
    [
      'produto',
      'Adicionar produto',
      'product'
    ],
    [
      'servico',
      'Adicionar serviço',
      'service'
    ],
    [
      'entrega',
      'Endereço de entrega',
      'text'
    ],
    [
      'garantia',
      'Garantia',
      'text'
    ],
    [
      'clausulas',
      'Cláusulas e condições',
      'textarea'
    ],
    [
      'informacoesAdicionais',
      'Informações adicionais',
      'textarea'
    ],
    [
      'outrosCustos',
      'Entrega e outros custos (R$)',
      'number'
    ]
  ],

  agenda:[
    [
      'diaTodo',
      'Dia inteiro',
      'checkbox'
    ],
    [
      'lembrete',
      'Lembrete',
      'select:Sem lembrete|Na hora|10 minutos antes|30 minutos antes|1 hora antes|1 dia antes'
    ],
    [
      'repetir',
      'Repetir',
      'select:Não repetir|Toda semana|Todo mês|Todo ano'
    ],
    [
      'endereco',
      'Endereço',
      'text'
    ]
  ],

  financeiro:[
    [
      'pedido',
      'Pedido relacionado',
      'order'
    ],
    [
      'status',
      'Situação',
      'select:Recebido|A receber|Atrasado'
    ],
    [
      'vencimento',
      'Vencimento',
      'date'
    ],
    [
      'parcelas',
      'Parcelas',
      'number'
    ],
    [
      'recorrente',
      'Lançamento recorrente',
      'select:Não|Mensal|Semanal|Anual'
    ],
    [
      'observacoes',
      'Informações adicionais',
      'textarea'
    ]
  ]
};

/* =========================================================
   FORMULÁRIOS
========================================================= */

function openForm(type,id,initialFields={}){

  if(type==='lancamentos'){
    type='financeiro';
  }

  if(!FIELDS[type]){
    return;
  }

  const item =
    id
      ? findList(type)
          .find(x => x.id===id) || {}
      : {};

  const labels = {
    clientes:'cliente',
    produtos:'produto',
    servicos:'serviço',
    pedidos:'pedido',
    agenda:'compromisso',
    financeiro:'recebimento ou custo',
    documentos:'documento'
  };

  const schema = [
    ...FIELDS[type],
    ...(EXTRA_FIELDS[type] || [])
  ];

  const formFields =
    schema
      .map(
        ([name,label,kind,required]) => {

          const initialValue =
            initialFields &&
            Object.prototype.hasOwnProperty.call(
              initialFields,
              name
            )
              ? initialFields[name]
              : undefined;

          const value =
            initialValue !== undefined
              ? initialValue
              : (
                  item[name] ??
                  (
                    name==='data'
                      ? (
                          type==='agenda'
                            ? agendaSelected
                            : todayISO()
                        )
                      : name==='status'
                      ? (
                          type==='agenda'
                            ? 'Confirmado'
                            : type==='pedidos'
                            ? 'Pendente'
                            : type==='financeiro'
                            ? 'A receber'
                            : 'Rascunho'
                        )
                      : name==='quantidade' ||
                        name==='parcelas'
                      ? 1
                      : name==='tipo' &&
                        type==='financeiro'
                      ? 'Despesa'
                      : ''
                  )
                );

          let control;

          if(kind==='textarea'){

            control = `
              <textarea
                name="${name}"
                ${required?'required':''}
              >${esc(value)}</textarea>
            `;

          }else if(kind==='client'){

            control = `
              <select name="${name}">

                <option value="">
                  Selecione um cliente
                </option>

                ${
                  db.clientes
                    .map(
                      c => `
                        <option
                          value="${esc(c.nome)}"
                          ${
                            c.nome===value
                              ? 'selected'
                              : ''
                          }
                        >
                          ${esc(c.nome)}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>
            `;

          }else if(kind==='order'){

            control = `
              <select name="${name}">

                <option value="">
                  Selecione um pedido
                </option>

                ${
                  db.pedidos
                    .map(
                      o => `
                        <option
                          value="${esc(o.numero)}"
                          ${
                            o.numero===value
                              ? 'selected'
                              : ''
                          }
                        >
                          ${esc(o.numero)}
                          ·
                          ${esc(o.cliente || '')}
                          ·
                          ${money(o.total)}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>
            `;

          }else if(
            kind==='product' ||
            kind==='service'
          ){

            const records =
              kind==='product'
                ? db.produtos
                : db.servicos;

            control = `
              <select name="${name}">

                <option value="">
                  Selecione ${
                    kind==='product'
                      ? 'um produto'
                      : 'um serviço'
                  }
                </option>

                ${
                  records
                    .map(
                      x => `
                        <option
                          value="${esc(x.nome)}"
                          data-price="${Number(x.preco)||0}"
                          ${
                            x.nome===value
                              ? 'selected'
                              : ''
                          }
                        >
                          ${esc(x.nome)}
                          ·
                          ${money(x.preco)}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>
            `;

          }else if(kind==='checkbox'){

            control = `
              <input
                type="hidden"
                name="${name}"
                value=""
              >

              <input
                name="${name}"
                value="1"
                type="checkbox"
                ${
                  value
                    ? 'checked'
                    : ''
                }
              >
            `;

          }else if(
            kind.startsWith('select:')
          ){

            control = `
              <select name="${name}">

                ${
                  kind
                    .slice(7)
                    .split('|')
                    .map(
                      v => `
                        <option
                          ${
                            String(value)
                              .toLowerCase()===
                            v.toLowerCase()
                              ? 'selected'
                              : ''
                          }
                        >
                          ${esc(v)}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>
            `;

          }else{

            control = `
              <input
                name="${name}"
                type="${kind}"
                value="${esc(value)}"
                ${required?'required':''}
                ${
                  kind==='number'
                    ? 'min="0" step="0.01"'
                    : ''
                }
              >
            `;
          }

          return `
            <div
              class="
                field
                ${
                  kind==='textarea'
                    ? 'full'
                    : ''
                }
                ${
                  kind==='checkbox'
                    ? 'field-check'
                    : ''
                }
              "
            >

              <label>
                ${label}
                ${required?' *':''}
              </label>

              ${control}

            </div>
          `;
        }
      )
      .join('');

  const idTitle =
    id
      ? 'Editar'
      : 'Novo';

  $('#modal-root').innerHTML = `
    <div
      class="modal-backdrop"
      data-close="1"
    >

      <section
        class="modal flow-${type}"
        role="dialog"
        aria-modal="true"
      >

        <div class="modal-head">

          <button
            class="modal-back"
            type="button"
            data-close="1"
          >
            ‹
          </button>

          <h2>
            ${idTitle}
            ${labels[type]}
          </h2>

          <button
            class="modal-close"
            data-close="1"
          >
            ×
          </button>

        </div>

        <form
          id="record-form"
          class="modal-form"
          data-type="${type}"
          data-id="${id || ''}"
        >

          <div class="form-grid">
            ${formFields}
          </div>

          <div class="form-actions">

            <button
              type="button"
              class="button soft"
              data-close="1"
            >
              Cancelar
            </button>

            <button
              class="button primary"
            >
              Salvar ${labels[type]}
            </button>

          </div>

        </form>

      </section>

    </div>
  `;

  $('#modal-root').onclick =
    e => {

      if(e.target.dataset.close){
        $('#modal-root').innerHTML='';
      }
    };

  if(type==='pedidos'){

    const form =
      $('#record-form');

    const recalc = () => {

      const product =
        form.elements.produto;

      const service =
        form.elements.servico;

      const p =
        Number(
          product
            ?.selectedOptions[0]
            ?.dataset.price
        ) || 0;

      const s =
        Number(
          service
            ?.selectedOptions[0]
            ?.dataset.price
        ) || 0;

      const q =
        Math.max(
          1,
          Number(
            form.elements.quantidade?.value
          ) || 1
        );

      const discount =
        Number(
          form.elements.desconto?.value
        ) || 0;

      const cost =
        Number(
          form.elements.outrosCustos?.value
        ) || 0;

      if(
        product?.value ||
        service?.value
      ){

        form.elements.descricao.value =
          [
            product?.value,
            service?.value
          ]
          .filter(Boolean)
          .join(' + ');

        form.elements.total.value =
          Math.max(
            0,
            (p+s)*q -
            discount +
            cost
          ).toFixed(2);
      }
    };

    form.addEventListener(
      'change',
      recalc
    );

    form.elements.quantidade
      ?.addEventListener(
        'input',
        recalc
      );

    form.elements.desconto
      ?.addEventListener(
        'input',
        recalc
      );

    form.elements.outrosCustos
      ?.addEventListener(
        'input',
        recalc
      );

    /*
      Se a IA preencheu produto/serviço,
      recalcula automaticamente.
    */
    setTimeout(
      recalc,
      30
    );
  }
}

function findList(type){

  return type==='financeiro'
    ? db.lancamentos
    : db[type];
}

/* =========================================================
   SALVAR
========================================================= */

function saveRecord(fd){

  const form =
    $('#record-form');

  const type =
    form.dataset.type;

  const id =
    form.dataset.id;

  const obj =
    Object.fromEntries(
      fd.entries()
    );

  const list =
    findList(type);

  if(type==='financeiro'){

    obj.tipo =
      obj.tipo.toLowerCase();
  }

  if(type==='pedidos'){

    obj.total =
      Number(obj.total) || 0;

    obj.numero =
      id
        ? (
            list.find(
              x => x.id===id
            )?.numero
          )
        : `PED-${String(
            list.length+1
          ).padStart(3,'0')}`;

    obj.quantidade =
      Number(obj.quantidade) || 1;

    obj.desconto =
      Number(obj.desconto) || 0;
  }

  if(type==='documentos'){

    obj.numero =
      id
        ? (
            list.find(
              x => x.id===id
            )?.numero ||
            `ORC-${String(
              list.length+1
            ).padStart(3,'0')}`
          )
        : `ORC-${String(
            list.length+1
          ).padStart(3,'0')}`;

    obj.status =
      'Rascunho';
  }

  const numericFields = [
    'preco',
    'custo',
    'estoque',
    'total',
    'valor',
    'quantidade',
    'desconto',
    'parcelas',
    'outrosCustos'
  ];

  for(
    const k of numericFields
  ){

    if(obj[k] !== undefined){

      obj[k] =
        Number(obj[k]) || 0;
    }
  }

  /*
    Checkboxes.
  */
  if(
    obj.diaTodo === undefined
  ){
    obj.diaTodo = '';
  }

  if(id){

    const i =
      list.findIndex(
        x => x.id===id
      );

    if(i>=0){

      list[i] = {
        ...list[i],
        ...obj
      };
    }

  }else{

    list.unshift({
      id:crypto.randomUUID(),
      ...obj
    });
  }

  persist();

  $('#modal-root').innerHTML='';

  render();

  toast(
    id
      ? 'Alterações salvas'
      : 'Registro salvo com sucesso'
  );
}

/* =========================================================
   EXCLUSÃO
========================================================= */

function removeRecord(type,id){

  const cloudType =
    type==='financeiro'
      ? 'lancamentos'
      : type;

  const list =
    findList(type);

  const item =
    list.find(
      x => x.id===id
    );

  if(!item) return;

  const name =
    item.nome ||
    item.numero ||
    item.descricao ||
    item.titulo ||
    'este registro';

  if(
    !confirm(
      `Excluir ${name}?`
    )
  ){
    return;
  }

  const index =
    list.findIndex(
      x => x.id===id
    );

  if(index<0) return;

  list.splice(
    index,
    1
  );

  persist();

  deleteFromCloud(
    cloudType,
    id
  );

  render();

  toast(
    'Registro excluído'
  );
}

/* =========================================================
   PDF
========================================================= */

function printPdf(type,id){

  if(
    type==='agenda' ||
    type==='financeiro' ||
    type==='relatorios'
  ){

    window.print();

    return;
  }

  const item =
    findList(type)
      ?.find(
        x => x.id===id
      );

  if(!item) return;

  const customer =
    db.clientes.find(
      c => c.nome===item.cliente
    );

  const title =
    type==='pedidos'
      ? 'Pedido'
      : type==='clientes'
      ? 'Ficha de cliente'
      : type==='lancamentos'
      ? (
          item.tipo==='receita'
            ? 'Recibo de pagamento'
            : 'Comprovante de despesa'
        )
      : item.tipo || 'Documento';

  const lines =
    type==='clientes'

      ? [
          ['Telefone',item.telefone],
          ['E-mail',item.email],
          [
            'Endereço',
            [
              item.endereco,
              item.cidade
            ]
            .filter(Boolean)
            .join(' · ')
          ],
          ['Observações',item.observacoes]
        ]

      : [
          ['Cliente',item.cliente],
          ['Descrição',item.descricao],
          ['Data',formatDate(item.data)],
          ['Validade',formatDate(item.validade)],
          ['Forma de pagamento',item.forma],
          ['Parcelas',item.parcelas],
          ['Status',item.status],
          ['Observações',item.observacoes]
        ];

  const total =
    item.total ??
    item.valor;

  const w =
    window.open(
      '',
      '_blank',
      'width=800,height=900'
    );

  if(!w){

    toast(
      'Permita janelas pop-up para gerar o PDF'
    );

    return;
  }

  w.document.write(`
    <!doctype html>

    <html lang="pt-BR">

    <meta charset="utf-8">

    <title>
      ${esc(title)}
      ${esc(
        item.numero ||
        item.nome ||
        ''
      )}
    </title>

    <style>

      body{
        font:14px Arial,sans-serif;
        color:#222;
        margin:42px
      }

      header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        border-bottom:2px solid #29252f;
        padding-bottom:18px
      }

      header img{
        width:190px;
        max-height:70px;
        object-fit:contain
      }

      h1{
        font-size:24px;
        margin:35px 0 6px
      }

      .muted{
        color:#777;
        font-size:12px
      }

      .box{
        border:1px solid #ddd;
        border-radius:8px;
        padding:18px;
        margin:20px 0
      }

      .line{
        display:flex;
        gap:16px;
        padding:10px 0;
        border-bottom:1px solid #eee
      }

      .line b{
        width:155px;
        color:#555
      }

      .total{
        font-size:20px;
        text-align:right;
        font-weight:bold;
        margin-top:22px
      }

      .signatures{
        display:flex;
        gap:60px;
        margin-top:100px
      }

      .signatures div{
        flex:1;
        border-top:1px solid #555;
        text-align:center;
        padding-top:9px;
        font-size:12px
      }

      footer{
        margin-top:50px;
        color:#777;
        font-size:11px;
        text-align:center
      }

      @media print{
        body{
          margin:18mm
        }
      }

    </style>

    <body>

      <header>

        <img
          src="${new URL(
            './LOGO.jpg',
            location.href
          )}"
        >

        <div
          style="text-align:right"
        >
          ${esc(
            db.config.empresa ||
            'Teixeira'
          )}
          <br>
          ${esc(
            db.config.telefone ||
            ''
          )}
          <br>
          ${esc(
            db.config.email ||
            ''
          )}
        </div>

      </header>

      <h1>
        ${esc(title)}
        ${esc(item.numero || '')}
      </h1>

      <div class="muted">
        Emitido em
        ${
          new Intl.DateTimeFormat(
            'pt-BR',
            {
              dateStyle:'long'
            }
          ).format(new Date())
        }
      </div>

      <div class="box">

        ${
          lines
            .filter(
              ([,v]) =>
                v!==undefined &&
                v!==null &&
                v!==''
            )
            .map(
              ([k,v]) => `
                <div class="line">

                  <b>
                    ${esc(k)}
                  </b>

                  <span>
                    ${esc(v)}
                  </span>

                </div>
              `
            )
            .join('')
        }

        ${
          customer?.telefone
          ?
          `
            <div class="line">

              <b>
                Contato
              </b>

              <span>
                ${esc(
                  customer.telefone
                )}
              </span>

            </div>
          `
          :
          ''
        }

        ${
          total!==undefined
          ?
          `
            <div class="total">
              Total:
              ${money(total)}
            </div>
          `
          :
          ''
        }

      </div>

      <div class="signatures">

        <div>
          Assinatura do profissional
        </div>

        <div>
          Assinatura do cliente
        </div>

      </div>

      <footer>
        Documento gerado pelo Teixeira Gestão
      </footer>

      <script>
        window.onload=() =>
          setTimeout(
            () => window.print(),
            400
          )
      <\/script>

    </body>

    </html>
  `);

  w.document.close();
}

/* =========================================================
   AÇÕES EXTRAS
========================================================= */

document.addEventListener(
  'click',
  e => {

    const pdf =
      e.target.closest(
        '[data-action="pdf"]'
      );

    if(pdf){

      printPdf(
        pdf.dataset.type,
        pdf.dataset.id
      );

      return;
    }

    const note =
      e.target.closest(
        '[data-action="note"]'
      );

    if(note){

      const value =
        prompt(
          'Escreva um resumo ou lembrete para aparecer na tela inicial:',
          db.config.resumo || ''
        );

      if(value!==null){

        db.config.resumo =
          value;

        persist();

        render();
      }
    }
  }
);

document.addEventListener(
  'click',
  e => {

    const stock =
      e.target.closest(
        '[data-action="stock"]'
      );

    if(!stock) return;

    const product =
      db.produtos.find(
        x => x.id===stock.dataset.id
      );

    if(!product) return;

    const amount =
      Number(
        prompt(
          `${
            stock.dataset.kind==='entrada'
              ? 'Adicionar ao'
              : 'Retirar do'
          } estoque de ${product.nome}:`,
          '1'
        )
      );

    if(
      !Number.isFinite(amount) ||
      amount<=0
    ){
      return;
    }

    if(
      stock.dataset.kind==='saida' &&
      amount >
      Number(product.estoque || 0)
    ){

      toast(
        'A quantidade excede o estoque atual'
      );

      return;
    }

    product.estoque =
      Number(product.estoque || 0) +
      (
        stock.dataset.kind==='entrada'
          ? amount
          : -amount
      );

    db.movimentacoes =
      db.movimentacoes || [];

    db.movimentacoes.unshift({
      id:crypto.randomUUID(),
      produto:product.nome,
      tipo:stock.dataset.kind,
      quantidade:amount,
      data:todayISO()
    });

    persist();

    render();

    toast(
      'Estoque atualizado'
    );
  }
);

/* =========================================================
   CLIENTE
========================================================= */

function showClient(id){

  const c =
    db.clientes.find(
      x => x.id===id
    );

  if(!c) return;

  const orders =
    db.pedidos.filter(
      x => x.cliente===c.nome
    );

  const receipts =
    db.lancamentos.filter(
      x => x.cliente===c.nome
    );

  const events =
    db.agenda.filter(
      x => x.cliente===c.nome
    );

  $('#modal-root').innerHTML = `
    <div
      class="modal-backdrop"
      data-close="1"
    >

      <section class="modal">

        <div class="modal-head">

          <h2>
            Histórico ·
            ${esc(c.nome)}
          </h2>

          <button
            class="modal-close"
            data-close="1"
          >
            ×
          </button>

        </div>

        <div class="modal-form">

          <div
            class="person-cell"
            style="margin-bottom:16px"
          >

            <span class="person-avatar">
              ${initials(c.nome)}
            </span>

            <span>

              <strong>
                ${esc(
                  c.telefone ||
                  'Sem telefone'
                )}
              </strong>

              <small>
                ${esc(
                  c.email ||
                  c.endereco ||
                  ''
                )}
              </small>

            </span>

          </div>

          <h3
            style="
              font:700 11px Manrope
            "
          >
            Pedidos (${orders.length})
          </h3>

          ${
            orders
              .map(
                x => `
                  <p style="font-size:10px">
                    ${esc(x.numero)}
                    ·
                    ${money(x.total)}
                    ·
                    ${esc(x.status)}
                  </p>
                `
              )
              .join('')

            ||

            `
              <p
                style="
                  font-size:10px;
                  color:#999
                "
              >
                Nenhum pedido registrado.
              </p>
            `
          }

          <h3
            style="
              font:700 11px Manrope;
              margin-top:15px
            "
          >
            Recebimentos (${receipts.length})
          </h3>

          ${
            receipts
              .map(
                x => `
                  <p style="font-size:10px">
                    ${esc(x.descricao)}
                    ·
                    ${money(x.valor)}
                    ·
                    ${formatDate(x.data)}
                  </p>
                `
              )
              .join('')

            ||

            `
              <p
                style="
                  font-size:10px;
                  color:#999
                "
              >
                Nenhum recebimento registrado.
              </p>
            `
          }

          <h3
            style="
              font:700 11px Manrope;
              margin-top:15px
            "
          >
            Compromissos (${events.length})
          </h3>

          ${
            events
              .map(
                x => `
                  <p style="font-size:10px">
                    ${formatDate(x.data)}
                    ·
                    ${esc(x.hora)}
                    ·
                    ${esc(x.titulo)}
                  </p>
                `
              )
              .join('')

            ||

            `
              <p
                style="
                  font-size:10px;
                  color:#999
                "
              >
                Nenhum compromisso registrado.
              </p>
            `
          }

        </div>

      </section>

    </div>
  `;

  $('#modal-root').onclick =
    e => {

      if(e.target.dataset.close){
        $('#modal-root').innerHTML='';
      }
    };
}

/* =========================================================
   BUSCA
========================================================= */

function findAll(q){

  const out = [];

  for(
    const type of [
      'clientes',
      'produtos',
      'servicos',
      'pedidos',
      'documentos',
      'lancamentos'
    ]
  ){

    for(
      const x of db[type]
    ){

      if(
        Object.values(x)
          .join(' ')
          .toLowerCase()
          .includes(q)
      ){

        out.push({
          type,
          name:
            x.nome ||
            x.numero ||
            x.descricao ||
            'Registro',

          detail:
            {
              clientes:'Cliente',
              produtos:'Produto',
              servicos:'Serviço',
              pedidos:'Pedido',
              documentos:'Documento',
              lancamentos:'Financeiro'
            }[type]
        });
      }
    }
  }

  return out;
}

function openGlobalSearch(){

  $('#modal-root').innerHTML = `
    <div
      class="modal-backdrop"
      data-close="1"
    >

      <section class="modal">

        <div class="modal-head">

          <h2>
            Busca rápida
          </h2>

          <button
            class="modal-close"
            data-close="1"
          >
            ×
          </button>

        </div>

        <div class="search-modal">

          <label class="search-box">

            <span>⌕</span>

            <input
              id="global-query"
              placeholder="Clientes, pedidos, produtos..."
              autofocus
            >

          </label>

          <div
            class="global-results"
            id="global-results"
          >
            <p
              style="
                font-size:10px;
                color:#999;
                padding:10px 2px
              "
            >
              Digite para pesquisar em seus registros.
            </p>
          </div>

        </div>

      </section>

    </div>
  `;

  $('#modal-root').onclick =
    e => {

      if(e.target.dataset.close){
        $('#modal-root').innerHTML='';
      }
    };

  $('#global-query').oninput =
    e => {

      const found =
        findAll(
          e.target.value.toLowerCase()
        );

      $('#global-results').innerHTML =
        found
          .map(
            x => `
              <button
                class="global-result"
                data-action="open"
                data-page="${
                  x.type==='lancamentos'
                    ? 'financeiro'
                    : x.type
                }"
              >
                <strong>
                  ${esc(x.name)}
                </strong>

                <span>
                  ${x.detail}
                </span>
              </button>
            `
          )
          .join('')

        ||

        `
          <p
            style="
              font-size:10px;
              color:#999;
              padding:10px 2px
            "
          >
            Nenhum resultado.
          </p>
        `;
    };
}

/* =========================================================
   CONFIGURAÇÕES / BACKUP
========================================================= */

document.addEventListener(
  'submit',
  e => {

    if(
      e.target.id==='settings-form'
    ){

      e.preventDefault();

      db.config = {
        ...db.config,
        ...Object.fromEntries(
          new FormData(
            e.target
          ).entries()
        )
      };

      persist();

      render();

      toast(
        'Dados da empresa atualizados'
      );
    }
  }
);

document.addEventListener(
  'change',
  e => {

    if(
      e.target.id!=='restore-file'
    ){
      return;
    }

    const file =
      e.target.files[0];

    if(!file) return;

    const r =
      new FileReader();

    r.onload = () => {

      try{

        db = {
          ...structuredClone(SEED),
          ...JSON.parse(r.result)
        };

        persist();

        render();

        toast(
          'Backup restaurado'
        );

      }catch(err){

        console.error(err);

        toast(
          'Arquivo de backup inválido'
        );
      }
    };

    r.readAsText(file);
  }
);

document.addEventListener(
  'click',
  e => {

    if(
      e.target.closest(
        '[data-action="backup"]'
      )
    ){

      const blob =
        new Blob(
          [
            JSON.stringify(
              db,
              null,
              2
            )
          ],
          {
            type:'application/json'
          }
        );

      const a =
        document.createElement('a');

      a.href =
        URL.createObjectURL(blob);

      a.download =
        'teixeira-backup.json';

      a.click();

      URL.revokeObjectURL(
        a.href
      );
    }
  }
);

/* =========================================================
   PEDIDOS
========================================================= */

document.addEventListener(
  'click',
  e => {

    const tab =
      e.target.closest(
        '[data-action="order-tab"]'
      );

    if(tab){

      orderListTab =
        tab.dataset.tab;

      renderTableRows();

      document
        .querySelectorAll(
          '.order-tabs button'
        )
        .forEach(
          b =>
            b.classList.toggle(
              'active',
              b===tab
            )
        );

      return;
    }

    const detail =
      e.target.closest(
        '[data-action="detail"]'
      );

    if(detail){

      selectedOrderId =
        detail.dataset.id;

      setPage(
        'pedido-detalhe'
      );

      return;
    }

    const edit =
      e.target.closest(
        '[data-action="edit-order"]'
      );

    if(edit){

      openForm(
        'pedidos',
        edit.dataset.id
      );

      return;
    }

    const del =
      e.target.closest(
        '[data-action="delete-order"]'
      );

    if(del){

      removeRecord(
        'pedidos',
        del.dataset.id
      );

      setPage(
        'pedidos'
      );

      return;
    }

    const action =
      e.target.closest(
        '[data-action="new"][data-type="financeiro"]'
      );

    if(action){

      setTimeout(
        () => {

          const select =
            $('#record-form [name="tipo"]');

          if(
            select &&
            /recebimento/i.test(
              action.textContent
            )
          ){

            select.value =
              'Receita';

          }else if(
            select &&
            /custo|despesa/i.test(
              action.textContent
            )
          ){

            select.value =
              'Despesa';
          }

        },
        0
      );
    }
  }
);

/* =========================================================
   FOTOS
========================================================= */

document.addEventListener(
  'click',
  e => {

    const remove =
      e.target.closest(
        '[data-action="remove-photo"]'
      );

    if(!remove) return;

    const order =
      db.pedidos.find(
        x =>
          x.id===remove.dataset.order
      );

    if(!order) return;

    order.fotos.splice(
      Number(remove.dataset.index),
      1
    );

    persist();

    render();

    toast(
      'Foto removida do pedido'
    );
  }
);

document.addEventListener(
  'change',
  e => {

    if(
      e.target.id!=='order-photo'
    ){
      return;
    }

    const order =
      db.pedidos.find(
        x => x.id===selectedOrderId
      );

    const files =
      [
        ...e.target.files || []
      ];

    if(
      !order ||
      !files.length
    ){
      return;
    }

    const toData =
      file =>
        new Promise(
          (resolve,reject) => {

            const reader =
              new FileReader();

            reader.onerror =
              reject;

            reader.onload =
              () => {

                const image =
                  new Image();

                image.onerror =
                  reject;

                image.onload =
                  () => {

                    const scale =
                      Math.min(
                        1,
                        1200 /
                        Math.max(
                          image.width,
                          image.height
                        )
                      );

                    const canvas =
                      document.createElement(
                        'canvas'
                      );

                    canvas.width =
                      Math.round(
                        image.width*scale
                      );

                    canvas.height =
                      Math.round(
                        image.height*scale
                      );

                    canvas
                      .getContext('2d')
                      .drawImage(
                        image,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                      );

                    resolve(
                      canvas.toDataURL(
                        'image/jpeg',
                        .78
                      )
                    );
                  };

                image.src =
                  reader.result;
              };

            reader.readAsDataURL(file);
          }
        );

    Promise.all(
      files.map(toData)
    )
    .then(
      images => {

        order.fotos =
          order.fotos || [];

        order.fotos.push(
          ...images.slice(
            0,
            Math.max(
              0,
              6-order.fotos.length
            )
          )
        );

        persist();

        render();

        toast(
          'Fotos anexadas ao pedido'
        );
      }
    )
    .catch(
      () =>
        toast(
          'Não foi possível carregar uma das fotos'
        )
    );
  }
);

/* =========================================================
   GESTÃO
========================================================= */

function gestaoPage(){

  const s =
    calcSummary();

  const months =
    Array.from(
      {length:6},
      (_,i) => {

        const d =
          new Date();

        d.setMonth(
          d.getMonth()-5+i
        );

        const key =
          `${d.getFullYear()}-${String(
            d.getMonth()+1
          ).padStart(2,'0')}`;

        const re =
          db.lancamentos
            .filter(
              x =>
                x.data?.startsWith(key) &&
                x.tipo==='receita'
            )
            .reduce(
              (a,x) =>
                a+Number(x.valor),
              0
            );

        const de =
          db.lancamentos
            .filter(
              x =>
                x.data?.startsWith(key) &&
                x.tipo==='despesa'
            )
            .reduce(
              (a,x) =>
                a+Number(x.valor),
              0
            );

        return {
          label:
            new Intl.DateTimeFormat(
              'pt-BR',
              {
                month:'short'
              }
            )
            .format(d)
            .replace('.',''),

          re,
          de
        };
      }
    );

  const max =
    Math.max(
      1,
      ...months.flatMap(
        x => [x.re,x.de]
      )
    );

  return `
    ${header(
      'Gestão',
      'Veja entradas, custos e resultado do seu negócio.',
      'relatorios'
    )}

    <div class="finance-filter">

      <label>
        Período

        <select>

          <option>
            Este ano
          </option>

          <option>
            Este mês
          </option>

          <option>
            Últimos 30 dias
          </option>

          <option>
            Todo o período
          </option>

        </select>
      </label>

      <button
        class="button soft small"
        data-action="open"
        data-page="financeiro"
      >
        Ver lançamentos
      </button>

    </div>

    <section class="panel management-chart">

      <div class="panel-head">

        <div>

          <h3>
            Receita x custo
          </h3>

          <small>
            Comparativo dos últimos seis meses
          </small>

        </div>

        <span class="chart-legend">
          <i></i> Receita
          <i class="expense-key"></i> Custo
        </span>

      </div>

      <div class="chart-columns">

        ${
          months
            .map(
              m => `
                <div class="chart-month">

                  <div class="chart-bars">

                    <i
                      class="chart-income"
                      style="
                        height:${Math.max(
                          4,
                          m.re/max*100
                        )}%
                      "
                      title="${money(m.re)}"
                    ></i>

                    <i
                      class="chart-cost"
                      style="
                        height:${Math.max(
                          4,
                          m.de/max*100
                        )}%
                      "
                      title="${money(m.de)}"
                    ></i>

                  </div>

                  <small>
                    ${esc(m.label)}
                  </small>

                </div>
              `
            )
            .join('')
        }

      </div>

    </section>

    <div class="finance-items management-metrics">

      <div class="panel finance-card">

        <span>
          Receita recebida
        </span>

        <strong>
          ${money(s.receitas)}
        </strong>

        <button
          data-action="open"
          data-page="financeiro"
        >
          Ver recebimentos →
        </button>

      </div>

      <div class="panel finance-card">

        <span>
          Valores a receber
        </span>

        <strong>
          ${money(s.pend)}
        </strong>

        <button
          data-action="open"
          data-page="pedidos"
        >
          Ver pedidos →
        </button>

      </div>

      <div class="panel finance-card">

        <span>
          Custos lançados
        </span>

        <strong>
          ${money(s.despesas)}
        </strong>

        <button
          data-action="open"
          data-page="financeiro"
        >
          Ver despesas →
        </button>

      </div>

      <div class="panel finance-card">

        <span>
          Resultado atual
        </span>

        <strong>
          ${money(s.saldo)}
        </strong>

        <small>
          Receitas registradas menos despesas
        </small>

      </div>

    </div>

    <div class="management-shortcuts">

      <button
        class="panel"
        data-action="new"
        data-type="financeiro"
      >
        ＋ Novo recebimento
      </button>

      <button
        class="panel"
        data-action="new"
        data-type="financeiro"
      >
        ＋ Novo custo
      </button>

      <button
        class="panel"
        data-action="pdf"
        data-type="relatorios"
      >
        Baixar relatório em PDF
      </button>

    </div>
  `;
}

/* =========================================================
   DETALHES DO PEDIDO
========================================================= */

function orderDetailPage(){

  const o =
    db.pedidos.find(
      x => x.id===selectedOrderId
    );

  if(!o){

    return `
      <div class="empty-state">

        <h3>
          Pedido não encontrado
        </h3>

        <button
          class="button primary"
          data-action="open"
          data-page="pedidos"
        >
          Voltar aos pedidos
        </button>

      </div>
    `;
  }

  const client =
    db.clientes.find(
      c => c.nome===o.cliente
    );

  return `
    <div class="detail-top">

      <button
        class="button soft small"
        data-action="open"
        data-page="pedidos"
      >
        ‹ Pedidos
      </button>

      <div>

        <button
          class="button soft small"
          data-action="pdf"
          data-type="pedidos"
          data-id="${o.id}"
        >
          Baixar PDF
        </button>

        <button
          class="button soft small"
          data-action="edit-order"
          data-id="${o.id}"
        >
          Editar
        </button>

        <button
          class="button danger small"
          data-action="delete-order"
          data-id="${o.id}"
        >
          Excluir
        </button>

      </div>

    </div>

    <div class="eyebrow">
      PEDIDO ${esc(o.numero || '')}
    </div>

    <h1 class="detail-title">
      Pedido ${esc(o.numero || '')}
    </h1>

    <p class="detail-sub">
      ${formatDate(o.data)}
      ·
      ${esc(o.cliente || 'Sem cliente')}
    </p>

    <section class="panel detail-total">

      <div>

        <span>
          Status
        </span>

        <strong
          class="
            status
            ${
              o.status==='Pendente'
                ? 'pending'
                : ''
            }
          "
        >
          ${esc(o.status)}
        </strong>

      </div>

      <div>

        <span>
          Total
        </span>

        <strong>
          ${money(o.total)}
        </strong>

      </div>

    </section>

    <details
      class="panel detail-section"
      open
    >

      <summary>
        Detalhes do pedido
      </summary>

      <div class="detail-fields">

        <p>
          <span>Cliente</span>
          <b>${esc(o.cliente || '—')}</b>
        </p>

        <p>
          <span>Telefone</span>
          <b>
            ${esc(
              client?.whatsapp ||
              client?.telefone ||
              '—'
            )}
          </b>
        </p>

        <p>
          <span>Itens e serviços</span>
          <b>${esc(o.descricao || '—')}</b>
        </p>

        <p>
          <span>Quantidade</span>
          <b>${o.quantidade || 1}</b>
        </p>

        <p>
          <span>Desconto</span>
          <b>${money(o.desconto || 0)}</b>
        </p>

        <p>
          <span>Condição</span>
          <b>${esc(o.condicao || '—')}</b>
        </p>

        <p>
          <span>Forma de pagamento</span>
          <b>${esc(o.forma || '—')}</b>
        </p>

        <p>
          <span>Parcelas</span>
          <b>${esc(o.parcelas || '—')}</b>
        </p>

        <p>
          <span>
            Entrega e custos adicionais
          </span>

          <b>
            ${money(o.outrosCustos || 0)}
            ·
            ${esc(o.entrega || '')}
          </b>
        </p>

        <p>
          <span>Garantia</span>
          <b>${esc(o.garantia || '—')}</b>
        </p>

        <p>
          <span>Cláusulas</span>
          <b>${esc(o.clausulas || '—')}</b>
        </p>

        <p>
          <span>
            Informações adicionais
          </span>

          <b>
            ${esc(
              o.informacoesAdicionais ||
              '—'
            )}
          </b>
        </p>

      </div>

    </details>

    <details
      class="panel detail-section"
    >

      <summary>
        Compromissos

        <button
          class="tiny-plus"
          data-action="new"
          data-type="agenda"
        >
          ＋
        </button>

      </summary>

      <div class="detail-fields">

        ${
          db.agenda
            .filter(
              a => a.cliente===o.cliente
            )
            .map(
              a => `
                <p>
                  <span>
                    ${formatDate(a.data)}
                    ·
                    ${esc(a.hora)}
                  </span>

                  <b>
                    ${esc(a.titulo)}
                  </b>
                </p>
              `
            )
            .join('')

          ||

          `
            <p class="detail-muted">
              Nenhum compromisso vinculado ao cliente.
            </p>
          `
        }

      </div>

    </details>

    <details
      class="panel detail-section"
    >

      <summary>
        Fotos e arquivos
      </summary>

      <div class="detail-fields">

        <div class="photo-grid">

          ${
            (o.fotos || [])
              .map(
                (src,i) => `
                  <div>

                    <img
                      src="${src}"
                      alt="Foto do pedido"
                    >

                    <button
                      data-action="remove-photo"
                      data-order="${o.id}"
                      data-index="${i}"
                      aria-label="Remover foto"
                    >
                      ×
                    </button>

                  </div>
                `
              )
              .join('')

            ||

            `
              <p class="detail-muted">
                Nenhuma foto anexada.
              </p>
            `
          }

        </div>

        <label
          class="button soft small"
        >
          ＋ Adicionar foto

          <input
            id="order-photo"
            type="file"
            accept="image/*"
            multiple
            hidden
          >

        </label>

      </div>

    </details>

    <button
      class="home-primary"
      data-action="edit-order"
      data-id="${o.id}"
    >
      Editar pedido
    </button>
  `;
}

/* =========================================================
   PREFERÊNCIAS
========================================================= */

function preferencesMenu(){

  const rows = [
    [
      'pedidos',
      '▤',
      'Pedidos',
      'Status, condições e campos dos pedidos'
    ],
    [
      'documentos',
      '▧',
      'Documentos',
      'Modelos de orçamento, recibo e contrato'
    ],
    [
      'financeiro',
      '＄',
      'Finanças e pagamentos',
      'Formas de pagamento e categorias de custos'
    ],
    [
      'agenda',
      '▦',
      'Agenda',
      'Lembretes e preferências de compromissos'
    ],
    [
      'produtos',
      '◇',
      'Peças & estoque',
      'Categorias e alertas de estoque'
    ],
    [
      'servicos',
      '✳',
      'Peças e serviços',
      'Catálogo de serviços'
    ],
    [
      'clientes',
      '♙',
      'Clientes',
      'Campos e dados de contato'
    ]
  ];

  return `
    <section class="preference-menu panel">

      <div class="panel-head">

        <div>

          <h3>
            Preferências
          </h3>

          <small>
            Atalhos e regras do seu espaço de trabalho
          </small>

        </div>

      </div>

      ${
        rows
          .map(
            ([page,icon,title,desc]) => `
              <button
                class="preference-row"
                data-action="open"
                data-page="${page}"
              >

                <span>
                  ${icon}
                </span>

                <div>

                  <strong>
                    ${title}
                  </strong>

                  <small>
                    ${desc}
                  </small>

                </div>

                <b>
                  ›
                </b>

              </button>
            `
          )
          .join('')
      }

      <button
        class="preference-row"
        data-action="open"
        data-page="configuracoes"
      >

        <span>
          ⚙
        </span>

        <div>

          <strong>
            Dados da empresa
          </strong>

          <small>
            Nome, endereço, telefone, e-mail e logo
          </small>

        </div>

        <b>
          ›
        </b>

      </button>

    </section>
  `;
}

/* =========================================================
   ASSISTENTE DE VOZ
========================================================= */

let voiceRecognition = null;
let voiceRecorder = null;
let voiceStream = null;
let voiceTranscript = '';

function openVoiceAssistant(){

  voiceTranscript = '';

  $('#modal-root').innerHTML = `
    <div
      class="modal-backdrop"
      data-close="1"
    >

      <section
        class="modal voice-modal"
        role="dialog"
        aria-modal="true"
      >

        <div class="modal-head">

          <h2>
            O que você precisa fazer?
          </h2>

          <button
            class="modal-close"
            data-close="1"
          >
            ×
          </button>

        </div>

        <div class="voice-body">

          <p>
            Grave uma instrução ou digite o que deseja.
            O Gemini vai preparar os campos para você
            conferir antes de salvar.
          </p>

          <div class="voice-controls">

            <button
              id="voice-start"
              class="voice-record"
            >
              <span>🎙</span>

              <strong>
                Começar gravação
              </strong>
            </button>

            <button
              id="voice-stop"
              class="button soft"
              disabled
            >
              Parar gravação
            </button>

            <span id="voice-state">
              Pronto para gravar
            </span>

          </div>

          <label
            class="field voice-transcript"
          >

            <span>
              Transcrição para revisar ou corrigir
            </span>

            <textarea
              id="voice-text"
              placeholder="Ex.: Agende uma consultoria para Mariana amanhã às 14h.
Ou digite aqui se a transcrição de voz não estiver disponível."
            ></textarea>

          </label>

          <label
            class="field voice-kind"
          >

            <span>
              O que o app deve preparar?
            </span>

            <select id="voice-action">

              <option value="auto">
                Detectar automaticamente
              </option>

              <option value="pedidos">
                Pedido
              </option>

              <option value="agenda">
                Compromisso
              </option>

              <option value="financeiro">
                Recebimento ou custo
              </option>

              <option value="clientes">
                Cadastro de cliente
              </option>

              <option value="documentos">
                Orçamento
              </option>

            </select>

          </label>

          <div class="voice-notice">

            O assistente usa o Gemini configurado no
            servidor. A chave da IA não fica no navegador.
            Nada será salvo até você revisar e confirmar.

          </div>

          <div class="voice-actions">

            <button
              class="button soft"
              data-close="1"
            >
              Cancelar
            </button>

            <button
              id="voice-analyze"
              class="button primary"
            >
              Interpretar e revisar
            </button>

          </div>

        </div>

      </section>

    </div>
  `;

  $('#modal-root').onclick =
    e => {

      if(e.target.dataset.close){

        stopVoiceRecording();

        $('#modal-root').innerHTML='';
      }
    };
}

async function startVoiceRecording(){

  if(
    !navigator.mediaDevices?.getUserMedia
  ){

    $('#voice-state').textContent =
      'Este navegador não permite acesso ao microfone.';

    return;
  }

  try{

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          audio:true
        });

    voiceStream =
      stream;

    voiceRecorder =
      new MediaRecorder(
        stream
      );

    const chunks = [];

    voiceRecorder.ondataavailable =
      e => {

        if(e.data.size){
          chunks.push(e.data);
        }
      };

    voiceRecorder.onstop =
      () => {

        window.lastVoiceRecording =
          new Blob(
            chunks,
            {
              type:
                voiceRecorder?.mimeType ||
                'audio/webm'
            }
          );

        stream
          .getTracks()
          .forEach(
            t => t.stop()
          );
      };

    voiceRecorder.start();

    const Speech =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if(Speech){

      voiceRecognition =
        new Speech();

      voiceRecognition.lang =
        'pt-BR';

      voiceRecognition.continuous =
        true;

      voiceRecognition.interimResults =
        true;

      voiceRecognition.onresult =
        e => {

          let text = '';

          for(
            let i=0;
            i<e.results.length;
            i++
          ){

            text +=
              e.results[i][0].transcript +
              (
                e.results[i].isFinal
                  ? ' '
                  : ''
              );
          }

          voiceTranscript =
            text;

          const box =
            $('#voice-text');

          if(box){
            box.value =
              text;
          }
        };

      voiceRecognition.onerror =
        () => {

          const state =
            $('#voice-state');

          if(state){

            state.textContent =
              'Gravação ativa. Você pode corrigir a transcrição no campo abaixo.';
          }
        };

      voiceRecognition.start();
    }

    $('#voice-state').textContent =
      'Gravando… fale com naturalidade';

    $('#voice-start').disabled =
      true;

    $('#voice-stop').disabled =
      false;

    $('#voice-start')
      .classList
      .add('recording');

  }catch(err){

    console.error(err);

    $('#voice-state').textContent =
      'Não consegui acessar o microfone. Verifique a permissão do navegador.';
  }
}

function stopVoiceRecording(){

  try{

    if(voiceRecognition){

      voiceRecognition.stop();

      voiceRecognition =
        null;
    }

    if(
      voiceRecorder?.state==='recording'
    ){

      voiceRecorder.stop();

    }else{

      voiceStream
        ?.getTracks()
        .forEach(
          t => t.stop()
        );
    }

  }catch{}

  voiceRecorder =
    null;

  voiceStream =
    null;

  const state =
    $('#voice-state');

  if(
    state &&
    $('#voice-stop')
  ){

    state.textContent =
      'Gravação finalizada. Confira a transcrição.';

    $('#voice-stop').disabled =
      true;

    $('#voice-start').disabled =
      false;

    $('#voice-start')
      .classList
      .remove('recording');
  }
}

/* =========================================================
   INTERPRETAÇÃO LOCAL
========================================================= */

function parseVoiceIntent(text){

  const lower =
    text.toLocaleLowerCase(
      'pt-BR'
    );

  let type;

  if(
    /\b(agend|compromisso|marcar hor[aá]rio|consulta)\w*/i
      .test(lower)
  ){

    type='agenda';

  }else if(
    /\b(receb|pagamento recebido|cobran[cç]|receita|gasto|despesa|custo|paguei|comprei)\w*/i
      .test(lower)
  ){

    type='financeiro';

  }else if(
    /\b(cliente|cadastrar contato)\w*/i
      .test(lower)
  ){

    type='clientes';

  }else if(
    /\bor[çc]amento\b/i
      .test(lower)
  ){

    type='documentos';

  }else{

    type='pedidos';
  }

  const override =
    $('#voice-action')?.value;

  if(
    override &&
    override!=='auto'
  ){

    type =
      override;
  }

  const fields = {};

  const client =
    db.clientes.find(
      c =>
        lower.includes(
          c.nome.toLocaleLowerCase(
            'pt-BR'
          )
        )
    );

  if(client){

    fields.cliente =
      client.nome;
  }

  const time =
    lower.match(
      /\b([01]?\d|2[0-3]):([0-5]\d)\b/
    );

  if(time){

    fields.hora =
      `${String(
        time[1]
      ).padStart(2,'0')}:${time[2]}`;
  }

  let date =
    todayISO();

  if(
    /\bamanh[ãa]\b/
      .test(lower)
  ){

    const d =
      new Date();

    d.setDate(
      d.getDate()+1
    );

    date =
      d.toISOString()
        .slice(0,10);

  }else{

    const m =
      lower.match(
        /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/
      );

    if(m){

      let year =
        Number(
          m[3] ||
          new Date()
            .getFullYear()
        );

      if(year<100){
        year += 2000;
      }

      date =
        `${year}-${String(
          m[2]
        ).padStart(2,'0')}-${String(
          m[1]
        ).padStart(2,'0')}`;
    }
  }

  const amountMatch =
    lower.match(
      /r\$\s*(\d+(?:\.\d{3})*(?:,\d{1,2})?)/i
    ) ||
    lower.match(
      /\b(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)\b/i
    );

  const amount =
    amountMatch
      ? Number(
          amountMatch[1]
            .replace(/\./g,'')
            .replace(',','.')
        )
      : undefined;

  if(type==='agenda'){

    fields.titulo =
      text;

    fields.data =
      date;

    fields.status =
      'Confirmado';

    fields.lembrete =
      '30 minutos antes';
  }

  if(type==='financeiro'){

    fields.tipo =
      /gasto|despesa|custo|paguei|comprei/i
        .test(lower)
        ? 'Despesa'
        : 'Receita';

    fields.descricao =
      text;

    fields.data =
      date;

    fields.status =
      fields.tipo==='Receita'
        ? 'A receber'
        : 'Recebido';

    if(amount!==undefined){
      fields.valor =
        amount;
    }
  }

  if(type==='pedidos'){

    fields.descricao =
      text;

    fields.data =
      date;

    fields.status =
      'Pendente';

    if(amount!==undefined){
      fields.total =
        amount;
    }
  }

  if(type==='documentos'){

    fields.tipo =
      'Orçamento';

    fields.descricao =
      text;

    fields.data =
      date;

    if(amount!==undefined){
      fields.total =
        amount;
    }
  }

  if(type==='clientes'){

    const m =
      text.match(
        /cliente\s+([\p{L}][\p{L} '-]{1,45})/iu
      );

    fields.nome =
      m?.[1]?.trim() || '';

    const phone =
      text.match(
        /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[- ]?\d{4}/
      );

    if(phone){
      fields.telefone =
        phone[0];
    }
  }

  return {
    type,
    fields,

    summary:
      `Entendi que você quer ${
        type==='agenda'
          ? 'criar um compromisso'
          : type==='financeiro'
          ? (
              fields.tipo==='Despesa'
                ? 'registrar um custo'
                : 'registrar um recebimento'
            )
          : type==='clientes'
          ? 'cadastrar um cliente'
          : type==='documentos'
          ? 'criar um orçamento'
          : 'criar um pedido'
      }. Confira e complete os campos antes de salvar.`
  };
}

/* =========================================================
   GEMINI
========================================================= */

async function interpretVoice(){

  const text =
    $('#voice-text')
      ?.value
      .trim();

  if(!text){

    toast(
      'Grave ou digite o que deseja fazer'
    );

    return;
  }

  let result =
    parseVoiceIntent(text);

  let notice =
    'Interpretação local';

  try{

    const response =
      await apiRequest(
        '/api/ai/interpret',
        {
          method:'POST',

          body:JSON.stringify({

            transcript:text,

            language:'pt-BR',

            today:todayISO(),

            allowedActions:[
              'pedidos',
              'agenda',
              'financeiro',
              'clientes',
              'documentos'
            ]

          })
        }
      );

    const allowed = [
      'pedidos',
      'agenda',
      'financeiro',
      'clientes',
      'documentos'
    ];

    if(
      !response ||
      !allowed.includes(
        response.action
      )
    ){

      throw new Error(
        'A IA retornou uma ação inválida.'
      );
    }

    if(
      !response.fields ||
      typeof response.fields!=='object'
    ){

      throw new Error(
        'A IA não retornou os campos corretamente.'
      );
    }

    result = {
      type:
        response.action,

      fields:
        response.fields || {},

      summary:
        response.summary ||
        'Confira os dados que a IA identificou.'
    };

    notice =
      'Sugestão do Gemini — revise antes de salvar';

  }catch(error){

    console.warn(
      'Gemini indisponível:',
      error
    );

    notice =
      'Gemini indisponível. Usei a interpretação local; confira os dados.';
  }

  const allowedFields =
    new Set([
      ...(FIELDS[result.type] || [])
        .map(x => x[0]),

      ...(EXTRA_FIELDS[result.type] || [])
        .map(x => x[0])
    ]);

  result.fields =
    Object.fromEntries(
      Object.entries(
        result.fields || {}
      )
      .filter(
        ([key,value]) =>
          allowedFields.has(key) &&
          [
            'string',
            'number',
            'boolean'
          ].includes(
            typeof value
          )
      )
    );

  $('#modal-root').innerHTML='';

  openForm(
    result.type,
    null,
    result.fields
  );

  const form =
    $('#record-form');

  if(!form) return;

  const summary =
    document.createElement(
      'div'
    );

  summary.className =
    'voice-review-note';

  summary.innerHTML = `
    <strong>
      ${esc(notice)}
    </strong>

    <span>
      ${esc(result.summary)}
    </span>

    <small>
      Transcrição:
      “${esc(text)}”
    </small>
  `;

  form.prepend(
    summary
  );

  for(
    const [key,value]
    of Object.entries(
      result.fields
    )
  ){

    const control =
      form.elements.namedItem(
        key
      );

    if(!control){
      continue;
    }

    if(
      control.type==='checkbox'
    ){

      control.checked =
        Boolean(value);

    }else{

      control.value =
        String(value);
    }

    control.dispatchEvent(
      new Event(
        'change',
        {
          bubbles:true
        }
      )
    );
  }

  const submit =
    form.querySelector(
      'button.primary'
    );

  if(submit){

    submit.textContent =
      'Confirmar e lançar no sistema';
  }
}

/* =========================================================
   PAINEL DA IA
========================================================= */

function aiEndpointPanel(){

  return `
    <section
      class="panel ai-settings"
    >

      <h3>
        Assistente por áudio e IA
      </h3>

      <p>
        O assistente utiliza o Gemini configurado
        no servidor para interpretar comandos de voz
        e texto.
      </p>

      <div class="info-box">

        <strong>
          IA configurada pelo servidor
        </strong>

        <p>
          A chave da inteligência artificial não fica
          armazenada no navegador e não é exibida
          nas preferências.
        </p>

        <p>
          Você pode falar ou digitar comandos como:
        </p>

        <ul>

          <li>
            "Agende uma consultoria para Mariana amanhã às 14h"
          </li>

          <li>
            "Cadastre o cliente João da Silva"
          </li>

          <li>
            "Crie um pedido de R$ 500 para Maria"
          </li>

          <li>
            "Registre uma despesa de R$ 200 com materiais"
          </li>

        </ul>

        <small>
          A IA apenas preenche os dados.
          Você sempre revisa antes de salvar.
        </small>

      </div>

    </section>
  `;
}

/* =========================================================
   EVENTOS DO ASSISTENTE
========================================================= */

document.addEventListener(
  'click',
  e => {

    if(
      e.target.closest(
        '#voice-start'
      )
    ){

      startVoiceRecording();
    }

    if(
      e.target.closest(
        '#voice-stop'
      )
    ){

      stopVoiceRecording();
    }

    if(
      e.target.closest(
        '#voice-analyze'
      )
    ){

      interpretVoice();
    }
    
  }
);

document.addEventListener(
  'change',
  e => {

    if(
      e.target.id==='voice-action'
    ){

      const box =
        $('#voice-text');

      if(box){
        box.focus();
      }
    }
  }
);

/* =========================================================
   INICIAR APLICAÇÃO
========================================================= */

init();

initializeCloud();
