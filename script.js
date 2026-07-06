// ==========================================
// 1. VARIÁVEIS E ELEMENTOS DA TELA
// ==========================================

let nomeCompradorAtual = "";

let VALOR_POR_NUMERO = 0.05; // Valor padrão inicial

// Função que busca o preço atual do banco
async function atualizarPrecoDoBanco() {
    const { data, error } = await db.from('configuracoes').select('valor_numero').eq('id', 1).single();
    if (data) {
        VALOR_POR_NUMERO = parseFloat(data.valor_numero);
        console.log("Preço carregado do banco:", VALOR_POR_NUMERO);
    }
}

// Chama a função assim que o script carregar
atualizarPrecoDoBanco();


const gridNumeros = document.getElementById('grid-numeros');
const btnComprar = document.getElementById('btn-comprar');
const qtdSelecionadosSpan = document.getElementById('qtd-selecionados');
const modalCheckout = document.getElementById('modal-checkout');
const fecharModal = document.getElementById('fechar-modal');
const resumoNumeros = document.getElementById('resumo-numeros');
let numerosSelecionados = [];
const modalPix = document.getElementById('modal-pix');
const fecharModalPix = document.getElementById('fechar-modal-pix');
const imgQrcode = document.getElementById('img-qrcode');
const inputCopiaCola = document.getElementById('input-copiacola');
const btnCopiar = document.getElementById('btn-copiar');
const spanTempoRestante = document.getElementById('tempo-restante');
let intervaloTimerPix; // Variável que vai guardar o motor do relógio

// ==========================================
// 2. CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
// ==========================================
// Cole sua URL e Key aqui:
const supabaseUrl = 'https://wfnimuncbyvfglhbqjtj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbmltdW5jYnl2ZmdsaGJxanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTkwMzIsImV4cCI6MjA5NjE5NTAzMn0.Q9GD87K1hQ0IYzN0sXuKOUWBvbXT9-K0DhWorIJwDdw';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase inicializado com sucesso!");

// ==========================================
// 3. LÓGICA DA GRADE DE NÚMEROS
// ==========================================
async function carregarGrade() {
    gridNumeros.innerHTML = ''; // Limpa a grade antes de carregar

    // Busca os números no banco
    const { data: numerosBanco, error } = await db
        .from('sorteio')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Erro ao buscar números no Supabase:", error);
        return;
    }

    // Cria os botões na tela
    numerosBanco.forEach(item => {
        const numeroFormatado = String(item.id).padStart(3, '0');
        const botao = document.createElement('button');
        botao.textContent = numeroFormatado;

        // Aplica o status que veio do banco
        botao.classList.add('numero', item.status);

        if (item.status === 'reservado' || item.status === 'pago') {
            botao.disabled = true;
        }

        // Lógica de clique no número
        botao.addEventListener('click', function () {
            if (!botao.classList.contains('reservado') && !botao.classList.contains('pago')) {
                botao.classList.toggle('selecionado');

                if (!botao.classList.contains('selecionado')) {
                    botao.classList.add('disponivel');
                } else {
                    botao.classList.remove('disponivel');
                }

                if (botao.classList.contains('selecionado')) {
                    numerosSelecionados.push(numeroFormatado);
                } else {
                    numerosSelecionados = numerosSelecionados.filter(num => num !== numeroFormatado);
                }
                atualizarBotaoCompra();
            }
        });

        gridNumeros.appendChild(botao);
    });
}

// Inicia a busca assim que o script carrega
carregarGrade();

// ==========================================
// 4. LÓGICA DO CARRINHO E MODAL
// ==========================================
function atualizarBotaoCompra() {
    qtdSelecionadosSpan.textContent = numerosSelecionados.length;
    if (numerosSelecionados.length > 0) {
        btnComprar.disabled = false;
    } else {
        btnComprar.disabled = true;
    }
}

// Abre o Modal
btnComprar.addEventListener('click', function () {
    numerosSelecionados.sort();
    resumoNumeros.textContent = `Números selecionados: ${numerosSelecionados.join(', ')}`;
    modalCheckout.classList.remove('escondido');
});

// Fecha o Modal no (X)
fecharModal.addEventListener('click', function () {
    modalCheckout.classList.add('escondido');
});

// Fecha o Modal clicando fora
window.addEventListener('click', function (event) {
    if (event.target === modalCheckout) {
        modalCheckout.classList.add('escondido');
    }
});

// ==========================================
// 5. ENVIANDO DADOS PARA O BANCO E GERANDO PIX
// ==========================================

// --- VALIDAÇÃO DO WHATSAPP ---
const zap = document.getElementById('whatsapp').value.replace(/\D/g, ''); // Remove tudo que não for número

let numerosEmPagamento = []; // Controla quais números o usuário atual está pagando

// INSERIR NA REGIÃO 5, LOGO ANTES DO ADDEVENTLISTENER DO FORM-CHECKOUT
// Criamos uma função separada para liberar o banco
async function liberarNumerosNoBanco(ids) {
    await db
        .from('sorteio')
        .update({
            status: 'disponivel',
            nome_comprador: null,
            reservado_em: null
        })
        .in('id', ids);
}

// Nossa função de timer agora chama a função acima de forma limpa
function iniciarCronometroPix() {
    let tempo = 120;
    spanTempoRestante.textContent = "02:00";
    clearInterval(intervaloTimerPix);

    intervaloTimerPix = setInterval(async () => { // O 'async' vai aqui no setInterval
        tempo--;
        const minutos = String(Math.floor(tempo / 60)).padStart(2, '0');
        const segundos = String(tempo % 60).padStart(2, '0');
        spanTempoRestante.textContent = `${minutos}:${segundos}`;

        if (tempo <= 0) {
            clearInterval(intervaloTimerPix);
            modalPix.classList.add('escondido');

            // Chamamos a função async que criamos lá em cima
            await liberarNumerosNoBanco(numerosEmPagamento);

            numerosEmPagamento = [];
            carregarGrade(); // Garante que a tela atualize
            alert("O tempo para pagamento expirou! Os números foram liberados.");
        }
    }, 1000);
}


// --- CONTADOR DE CARACTERES DA MENSAGEM ---
const campoMensagem = document.getElementById('mensagem');
const contadorMsg = document.getElementById('contador-msg');

campoMensagem.addEventListener('input', function () {
    const limite = 200;
    const digitado = campoMensagem.value.length;
    const restante = limite - digitado;

    contadorMsg.textContent = `${restante} caracteres restantes`;

    // Efeito visual: Muda a cor para vermelho quando estiver acabando (menos de 20 letras)
    if (restante <= 20) {
        contadorMsg.style.color = '#ff4d4d'; // Vermelho de alerta
    } else {
        contadorMsg.style.color = '#888'; // Cor padrão
    }
});


document.getElementById('form-checkout').addEventListener('submit', async function (e) {
    e.preventDefault();
    console.log("O botão de confirmar foi clicado e o form disparou!");

    // 1. Pegamos o valor bruto primeiro
    const zapBruto = document.getElementById('whatsapp').value;
    const zap = zapBruto.replace(/\D/g, ''); // Remove caracteres especiais

    // 2. Fazemos a validação
    if (zap.length < 10 || zap.length > 11) {
        alert("Por favor, insira um número de WhatsApp válido com DDD.");
        document.getElementById('whatsapp').focus();
        return; // Agora funciona, está dentro da função
    }

    // 3. Agora o restante do código usa o 'zap' que já está limpo:
    const btnConfirmar = document.querySelector('.btn-confirmar');
    if (btnConfirmar.disabled) return; // Se já estiver travado, ignora novos cliques

    const textoOriginalBotao = btnConfirmar.textContent;
    btnConfirmar.textContent = 'Processando...';
    btnConfirmar.disabled = true; // Botão fica cinza e não clicável

    const nome = document.getElementById('nome').value;
    nomeCompradorAtual = nome;
    const email = document.getElementById('email').value;
    const msgTexto = document.getElementById('mensagem').value;
    const msg = `${msgTexto}`;

    const idsParaAtualizar = numerosSelecionados.map(num => parseInt(num, 10));
    const totalCompra = numerosSelecionados.length * VALOR_POR_NUMERO;

    // Salva os números que estão sendo comprados nesta sessão
    numerosEmPagamento = [...idsParaAtualizar];

    try {
        console.log("Iniciando envio para o banco..."); // <-- RASTREAMENTO 1

        const { error: erroBanco, data } = await db
            .from('sorteio')
            .update({
                status: 'reservado',
                nome_comprador: nome,
                whatsapp: zap,
                email: email,
                mensagem_live: msg,
                reservado_em: new Date().toISOString()
            })
            .in('id', idsParaAtualizar);

        if (erroBanco) {
            console.error("ERRO DETALHADO DO SUPABASE:", erroBanco); // <-- RASTREAMENTO 2
            throw erroBanco;
        }

        console.log("Reserva enviada com sucesso ao banco!"); // <-- RASTREAMENTO 3

        // --- FORÇAR ATUALIZAÇÃO VISUAL IMEDIATA ---
        idsParaAtualizar.forEach(id => {
            const idFormatado = String(id).padStart(3, '0');
            const botoes = document.querySelectorAll('.numero');
            botoes.forEach(b => {
                if (b.textContent === idFormatado) {
                    b.classList.remove('selecionado', 'disponivel');
                    b.classList.add('reservado'); // AQUI O MÁGICO ACONTECE
                    b.disabled = true;
                }
            });
        });

        // Enviamos também os 'ids' na requisição para a Edge Function
        const respostaPix = await fetch(`${supabaseUrl}/functions/v1/gerar-pix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({ valor: valorTotal, email: email, nome: nome, ids: idsParaAtualizar })
        });

        if (!respostaPix.ok) {
            const erroDetalhado = await respostaPix.text();
            throw new Error(`Status ${respostaPix.status}: ${erroDetalhado}`);
        }

        const dadosPix = await respostaPix.json();

        imgQrcode.src = `data:image/jpeg;base64,${dadosPix.qr_code_base64}`;
        imgQrcode.style.display = 'inline-block';
        inputCopiaCola.value = dadosPix.qr_code;

        // Reseta o texto do modal para o estado de espera
        const statusTxt = document.getElementById('status-pagamento');
        statusTxt.textContent = "⏳ Aguardando pagamento...";
        statusTxt.style.color = "#e1a000";

        modalCheckout.classList.add('escondido');
        document.getElementById('form-checkout').reset();
        modalPix.classList.remove('escondido');

        // INSERIR ESTA LINHA AQUI:
        iniciarCronometroPix(); // <--- Dá o play no relógio!

        numerosSelecionados = [];
        atualizarBotaoCompra();
        // carregarGrade();

    } catch (erro) {
        console.error("Erro na operação:", erro);
        alert("Ops! Houve um erro ao processar. Tente novamente.");
    } finally {
        btnConfirmar.textContent = textoOriginalBotao;
        btnConfirmar.disabled = false;
    }
});


// --- FUNÇÃO DE APOIO PARA LIBERAR NÚMEROS
async function liberarNumerosNoBanco(ids) {
    if (ids.length > 0) {
        await db
            .from('sorteio')
            .update({
                status: 'disponivel',
                nome_comprador: null,
                whatsapp: null,
                email: null,
                mensagem_live: null,
                reservado_em: null
            })
            .in('id', ids);
    }
}

// --- INÍCIO DA INSERÇÃO: Envio de E-mail ---
function enviarEmailComprovante(nomeComprador, emailComprador, numerosComprados) {
    // Verificação de segurança: não tenta enviar se faltar o e-mail
    if (!emailComprador) {
        console.warn("E-mail não fornecido. Disparo cancelado.");
        return;
    }

    // Parâmetros que vão preencher as variáveis {{nome}}, {{numeros}} e {{email_destino}} lá no template do EmailJS
    const templateParams = {
        nome: nomeComprador,
        numeros: numerosComprados.join(', '), // Transforma o array [1,2,3] em texto "1, 2, 3"
        email_destino: emailComprador
    };

    // Substitua os valores abaixo pelos seus IDs reais do painel do EmailJS
    const SERVICE_ID = 'service_b7krsmk';
    const TEMPLATE_ID = 'template_glemw92';

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams)
        .then(function (response) {
            console.log('E-MAIL ENVIADO COM SUCESSO!', response.status, response.text);
        }, function (error) {
            console.error('FALHA AO ENVIAR E-MAIL...', error);
        });
}
// --- FIM DA INSERÇÃO ---

// --- EVENTO DE FECHAR O MODAL ---

// 1. Isolamos a lógica em uma função para reutilizar nos dois tipos de clique
async function fecharModalPixELimparEstado() {
    modalPix.classList.add('escondido');
    clearInterval(intervaloTimerPix);

    if (numerosEmPagamento.length > 0) {
        liberarNumerosNoBanco(numerosEmPagamento).then(() => {
            numerosEmPagamento = [];
            carregarGrade(); // Recarrega a grade para garantir que voltem como disponíveis
        });
    }

    // --- LIMPEZA DE ESTADO (FIM DO BUG DO F5) ---
    nomeCompradorAtual = ''; // Zera a variável global

    const camposParaLimpar = ['nome', 'email', 'mensagem'];
    camposParaLimpar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });

    const selectVoz = document.getElementById('voz-bot');
    if (selectVoz) selectVoz.selectedIndex = 0;
}

// 2. Dispara ao clicar no botão "fechar"
fecharModalPix.addEventListener('click', fecharModalPixELimparEstado);

// 3. Dispara ao clicar FORA do modal (no fundo escuro)
window.addEventListener('click', function (event) {
    // Se o elemento clicado for exatamente o fundo do modalPix, ele fecha e limpa
    if (event.target === modalPix) {
        fecharModalPixELimparEstado();
    }
});

btnCopiar.addEventListener('click', () => {
    inputCopiaCola.select();
    document.execCommand('copy');
    const textoAntigo = btnCopiar.textContent;
    btnCopiar.textContent = 'Copiado!';
    btnCopiar.style.backgroundColor = '#00875f';
    setTimeout(() => {
        btnCopiar.textContent = textoAntigo;
        btnCopiar.style.backgroundColor = '#8257e5';
    }, 2000);
});

// ==========================================
// 6. REALTIME (A Mágica do Tempo Real)
// ==========================================
db.channel('mudancas_sorteio')
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sorteio' },
        (payload) => {
            const numeroMudou = payload.new;
            const idFormatado = String(numeroMudou.id).padStart(3, '0');

            // --- NOTIFICAÇÃO DO COMPRADOR NO MODAL ---
            // Se o número que mudou para 'pago' for o que este usuário acabou de comprar:
            // --- NOTIFICAÇÃO DO COMPRADOR NO MODAL ---
            if (numerosEmPagamento.includes(numeroMudou.id) && numeroMudou.status === 'pago') {
                const modalContent = modalPix.querySelector('.modal-content'); // Ajuste o seletor se necessário
                const numerosComprados = numerosEmPagamento.map(n => String(n).padStart(3, '0')).join(', ');

                // Limpa o conteúdo antigo (QR Code, Timer, Inputs) e insere a mensagem de sucesso
                modalPix.querySelector('.modal-content').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2 style="color: #00875f;">✅ Pagamento realizado com sucesso!</h2>
            <p>Seus números da sorte são:</p>
            <div style="font-size: 1.5rem; font-weight: bold; margin: 15px 0; color: #8257e5;">
                ${numerosComprados}
            </div>
            <p style="font-size: 0.9rem; color: #ccc;">
                Print esta tela para guardar seus números ou baixe o comprovante oficial clicando no botão abaixo:
            </p>
            <button onclick="baixarComprovante()" 
                    style="width: 100%; background:#8257e5; color:white; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; margin-top: 10px;">
                    📥 Baixar Comprovante
            </button>
            <button onclick="modalPix.classList.add('escondido')" 
                    style="width: 100%; background:transparent; color:#888; padding:10px; border:1px solid #444; border-radius:8px; cursor:pointer; margin-top: 10px;">
                    Fechar
            </button>
        </div>
    `;
                // --- INÍCIO DA INSERÇÃO: DISPARO DO E-MAIL ---
                // Verifica se o timer ainda está ativo. Isso garante que o e-mail 
                // seja enviado apenas UMA VEZ, mesmo se o usuário comprou vários números juntos.
                if (intervaloTimerPix !== null) {
                    // Puxa o e-mail diretamente da resposta do banco de dados (numeroMudou.email)
                    enviarEmailComprovante(nomeCompradorAtual, numeroMudou.email, numerosEmPagamento);

                    // Para o cronômetro imediatamente e anula a variável
                    clearInterval(intervaloTimerPix);
                    intervaloTimerPix = null;
                }
                // --- FIM DA INSERÇÃO ---

                // Para o cronômetro imediatamente
                clearInterval(intervaloTimerPix);
            }
            // ------------------------------------------

            const botoes = document.querySelectorAll('.numero');
            botoes.forEach(botao => {
                if (botao.textContent === idFormatado) {
                    botao.classList.remove('disponivel', 'selecionado', 'reservado', 'pago');
                    botao.classList.add(numeroMudou.status);

                    if (numeroMudou.status === 'reservado' || numeroMudou.status === 'pago') {
                        botao.disabled = true;
                        if (numerosSelecionados.includes(idFormatado)) {
                            numerosSelecionados = numerosSelecionados.filter(num => num !== idFormatado);
                            atualizarBotaoCompra();
                        }
                    } else {
                        botao.disabled = false;
                    }
                }
            });
        }
    )
    .subscribe();

// --- FUNÇÃO PARA GERAR COMPROVANTE PDF ---
function baixarComprovante() {
    const nome = nomeCompradorAtual || "Participante"; // Usa a variável que salvamos
    const numeros = numerosEmPagamento.map(n => String(n).padStart(3, '0')).join(', ');

    const conteudo = `
        Comprovante de Participação - Sorteio Arcade Stick
        -------------------------------------------------
        Nome: ${nome}
        Números: ${numeros}
        Data: ${new Date().toLocaleString()}
        -------------------------------------------------
        Guarde este comprovante para conferência!
    `;

    const blob = new Blob([conteudo], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante_sorteio_${nome.replace(/\s+/g, '_')}.txt`;
    a.click();
}