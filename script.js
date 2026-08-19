// ==========================================
// 1. VARIÁVEIS E ELEMENTOS DA TELA
// ==========================================

let nomeCompradorAtual = "";

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

// --- INÍCIO DA INSERÇÃO: Sincronização em Tempo Real ---
db.channel('mudancas_config')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracoes' }, payload => {
    console.log("Mudança detectada, atualizando informações...");
    carregarInfoSorteioPublico(); 
    location.reload(); 
  })
  .subscribe();
// --- FIM DA INSERÇÃO ---

let intervaloTimerPix; 
let TEMPO_LIMITE_PIX = 10; 

async function buscarConfiguracoes() {
    const { data } = await db.from('configuracoes').select('valor_numero, tempo_pix_minutos').eq('id', 1).single();
    if (data) {
        VALOR_POR_NUMERO = parseFloat(data.valor_numero);
        TEMPO_LIMITE_PIX = parseInt(data.tempo_pix_minutos);
        console.log("Configurações carregadas: Valor R$", VALOR_POR_NUMERO, "| Tempo:", TEMPO_LIMITE_PIX, "min");
    }
}

// ==========================================
// 3. LÓGICA DA GRADE DE NÚMEROS
// ==========================================
async function carregarGrade() {
    gridNumeros.innerHTML = ''; 

    const { data: numerosBanco, error } = await db
        .from('sorteio')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Erro ao buscar números no Supabase:", error);
        return;
    }

    numerosBanco.forEach(item => {
        const numeroFormatado = String(item.id).padStart(3, '0');
        const botao = document.createElement('button');
        botao.textContent = numeroFormatado;

        botao.classList.add('numero', item.status);

        if (item.status === 'reservado' || item.status === 'pago') {
            botao.disabled = true;
        }

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

// ==========================================
// 4. LÓGICA DO CARRINHO E MODAL
// ==========================================
function atualizarBotaoCompra() {
    qtdSelecionadosSpan.textContent = numerosSelecionados.length;

    if (numerosSelecionados.length > 0) {
        btnComprar.disabled = false;
        btnComprar.classList.add('visivel');
        btnComprar.textContent = `COMPRAR ${numerosSelecionados.length} NÚMERO(S)`;
    } else {
        btnComprar.disabled = true;
        btnComprar.classList.remove('visivel');
        btnComprar.textContent = "COMPRAR"; 
    }
}

btnComprar.addEventListener('click', function () {
    numerosSelecionados.sort();
    resumoNumeros.textContent = `Números selecionados: ${numerosSelecionados.join(', ')}`;
    modalCheckout.classList.remove('escondido');
});

fecharModal.addEventListener('click', function () {
    modalCheckout.classList.add('escondido');
});

window.addEventListener('click', function (event) {
    if (event.target === modalCheckout) {
        modalCheckout.classList.add('escondido');
    }
});

// ==========================================
// 5. ENVIANDO DADOS PARA O BANCO E GERANDO PIX
// ==========================================

const zap = document.getElementById('whatsapp').value.replace(/\D/g, ''); 
let numerosEmPagamento = []; 

// --- FUNÇÃO DE APOIO PARA LIBERAR NÚMEROS (BLINDADA) ---
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
            .in('id', ids)
            .eq('status', 'reservado'); // SEGURANÇA: Só libera se ainda for 'reservado'. Impede soltar número já pago!
    }
}

function iniciarCronometroPix() {
    let tempo = TEMPO_LIMITE_PIX * 60;

    const minInicial = String(Math.floor(tempo / 60)).padStart(2, '0');
    const segInicial = String(tempo % 60).padStart(2, '0');
    spanTempoRestante.textContent = `${minInicial}:${segInicial}`;

    clearInterval(intervaloTimerPix);

    intervaloTimerPix = setInterval(async () => {
        tempo--;
        const minutos = String(Math.floor(tempo / 60)).padStart(2, '0');
        const segundos = String(tempo % 60).padStart(2, '0');
        spanTempoRestante.textContent = `${minutos}:${segundos}`;

        if (tempo <= 0) {
            clearInterval(intervaloTimerPix);
            modalPix.classList.add('escondido');

            await liberarNumerosNoBanco(numerosEmPagamento);

            numerosEmPagamento = [];
            carregarGrade();
            alert("O tempo para pagamento expirou! Os números foram liberados.");
        }
    }, 1000);
}

const campoMensagem = document.getElementById('mensagem');
const contadorMsg = document.getElementById('contador-msg');

campoMensagem.addEventListener('input', function () {
    const limite = 200;
    const digitado = campoMensagem.value.length;
    const restante = limite - digitado;

    contadorMsg.textContent = `${restante} caracteres restantes`;

    if (restante <= 20) {
        contadorMsg.style.color = '#ff4d4d'; 
    } else {
        contadorMsg.style.color = '#888'; 
    }
});

// --- SUBMISSÃO DO FORMULÁRIO (TRAVA ATÔMICA) ---
document.getElementById('form-checkout').addEventListener('submit', async function (e) {
    e.preventDefault();
    console.log("O botão de confirmar foi clicado e o form disparou!");

    const zapBruto = document.getElementById('whatsapp').value;
    const zap = zapBruto.replace(/\D/g, ''); 

    if (zap.length < 10 || zap.length > 11) {
        alert("Por favor, insira um número de WhatsApp válido com DDD.");
        document.getElementById('whatsapp').focus();
        return;
    }

    const btnConfirmar = document.querySelector('.btn-confirmar');
    if (btnConfirmar.disabled) return; 

    const textoOriginalBotao = btnConfirmar.textContent;
    btnConfirmar.textContent = 'Processando...';
    btnConfirmar.disabled = true;

    const nome = document.getElementById('nome').value;
    nomeCompradorAtual = nome;
    const email = document.getElementById('email').value;
    const msgTexto = document.getElementById('mensagem').value;
    const msg = `${msgTexto}`;

    const idsParaAtualizar = numerosSelecionados.map(num => parseInt(num, 10));
    const totalCompra = numerosSelecionados.length * VALOR_POR_NUMERO;
    const valorFormatado = parseFloat(totalCompra.toFixed(2)); 

    console.log("Enviando valor para API:", valorFormatado);

    numerosEmPagamento = [...idsParaAtualizar];

    try {
        console.log("1. Verificando disponibilidade dos números ANTES de gerar o PIX...");

        // 1. CHECAGEM PRÉVIA: Só olha, não altera. 
        const { data: checagem, error: erroChecagem } = await db
            .from('sorteio')
            .select('id, status')
            .in('id', idsParaAtualizar);

        if (erroChecagem) throw erroChecagem;

        // Filtra para ver se algum dos números não está mais disponível
        const numerosRoubados = checagem.filter(num => num.status !== 'disponivel');
        
        if (numerosRoubados.length > 0) {
            // Mapeia os IDs roubados para o formato bonitinho (ex: 001, 015)
            const nomesRoubados = numerosRoubados.map(n => String(n.id).padStart(3, '0')).join(', ');
            
            // Mensagem transparente pro usuário
            alert(`⚠️ Ops! O(s) número(s) ${nomesRoubados} já foi(ram) escolhido(s) por outra pessoa. Por favor, escolha outro(s).`);
            
            carregarGrade(); // Atualiza a tela na hora para ele ver os números vermelhos
            modalCheckout.classList.add('escondido');
            btnConfirmar.textContent = textoOriginalBotao;
            btnConfirmar.disabled = false;
            return; // PARA A COMPRA AQUI: Nenhum PIX é gerado!
        }

        console.log("Números livres! 2. Chamando API do PIX...");

        // 2. CHAMA A API DO PIX (Seguro, pois sabemos que estão livres)
        const respostaPix = await fetch(`${supabaseUrl}/functions/v1/gerar-pix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({
                valor: valorFormatado,
                email: email,
                nome: nome,
                ids: idsParaAtualizar
            })
        });

        if (!respostaPix.ok) {
            const erroDetalhado = await respostaPix.text();
            throw new Error(`Erro na API do PIX: ${erroDetalhado}`);
        }
        const dadosPix = await respostaPix.json();

        console.log("PIX Gerado! 3. Travando os números no banco...");

        // 3. ATUALIZAÇÃO ATÔMICA (A Trava Final de segurança)
        // Isso protege caso alguém clique EXATAMENTE no mesmo milissegundo que a API do PIX estava carregando
        const { data: updateData, error: erroBanco } = await db
            .from('sorteio')
            .update({
                status: 'reservado',
                nome_comprador: nome,
                whatsapp: zap,
                email: email,
                mensagem_live: msg,
                reservado_em: new Date().toISOString()
            })
            .in('id', idsParaAtualizar)
            .eq('status', 'disponivel')
            .select('id'); 

        if (erroBanco) throw erroBanco;

        if (!updateData || updateData.length !== idsParaAtualizar.length) {
            alert(`⚠️ Que azar terrível! Outra pessoa finalizou a compra de um dos seus números milissegundos antes de você. Por segurança, cancele este PIX e tente novamente.`);
            carregarGrade(); 
            modalCheckout.classList.add('escondido');
            btnConfirmar.textContent = textoOriginalBotao;
            btnConfirmar.disabled = false;
            return; 
        }

        console.log("Você ganhou a corrida! Exibindo QR Code...");

        // --- FORÇAR ATUALIZAÇÃO VISUAL IMEDIATA ---
        idsParaAtualizar.forEach(id => {
            const idFormatado = String(id).padStart(3, '0');
            const botoes = document.querySelectorAll('.numero');
            botoes.forEach(b => {
                if (b.textContent === idFormatado) {
                    b.classList.remove('selecionado', 'disponivel');
                    b.classList.add('reservado'); 
                    b.disabled = true;
                }
            });
        });

        // 4. MOSTRA O PIX NA TELA
        imgQrcode.src = `data:image/jpeg;base64,${dadosPix.qr_code_base64}`;
        imgQrcode.style.display = 'inline-block';
        inputCopiaCola.value = dadosPix.qr_code;

        const statusTxt = document.getElementById('status-pagamento');
        statusTxt.textContent = "⏳ Aguardando pagamento...";
        statusTxt.style.color = "#e1a000";

        modalCheckout.classList.add('escondido');
        document.getElementById('form-checkout').reset();
        modalPix.classList.remove('escondido');

        iniciarCronometroPix(); 

        numerosSelecionados = [];
        atualizarBotaoCompra();

    } catch (err) {
        console.error("DETALHE DO ERRO:", err);
        alert("Erro ao processar: " + (err.message || "Verifique o console (F12)"));
    } finally {
        btnConfirmar.textContent = textoOriginalBotao;
        btnConfirmar.disabled = false;
    }
});

function enviarEmailComprovante(nomeComprador, emailComprador, numerosComprados) {
    if (!emailComprador) {
        console.warn("E-mail não fornecido. Disparo cancelado.");
        return;
    }

    const templateParams = {
        nome: nomeComprador,
        numeros: numerosComprados.join(', '), 
        email_destino: emailComprador
    };

    const SERVICE_ID = 'service_b7krsmk';
    const TEMPLATE_ID = 'template_glemw92';

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams)
        .then(function (response) {
            console.log('E-MAIL ENVIADO COM SUCESSO!', response.status, response.text);
        }, function (error) {
            console.error('FALHA AO ENVIAR E-MAIL...', error);
        });
}

// ==========================================
// 6. EVENTOS DO MODAL E REALTIME
// ==========================================

async function fecharModalPixELimparEstado() {
    modalPix.classList.add('escondido');

    clearInterval(intervaloTimerPix);

    if (numerosEmPagamento.length > 0) {
        liberarNumerosNoBanco(numerosEmPagamento).then(() => {
            numerosEmPagamento = [];
            carregarGrade(); 
        });
    }

    nomeCompradorAtual = ''; 

    const camposParaLimpar = ['nome', 'email', 'mensagem'];
    camposParaLimpar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });

    const selectVoz = document.getElementById('voz-bot');
    if (selectVoz) selectVoz.selectedIndex = 0;
}

fecharModalPix.addEventListener('click', fecharModalPixELimparEstado);

window.addEventListener('click', function (event) {
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

// --- REALTIME ---
db.channel('mudancas_sorteio')
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sorteio' },
        (payload) => {
            const numeroMudou = payload.new;
            const idFormatado = String(numeroMudou.id).padStart(3, '0');

            if (numerosEmPagamento.includes(numeroMudou.id) && numeroMudou.status === 'pago') {
                const numerosComprados = numerosEmPagamento.map(n => String(n).padStart(3, '0')).join(', ');

                modalPix.querySelector('.modal-content').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2 style="color: #00875f;">✅ Pagamento realizado com sucesso!</h2>
            <p>Seus números da sorte são:</p>
            <div style="font-size: 1.5rem; font-weight: bold; margin: 15px 0; color: #015488a;">
                ${numerosComprados}
            </div>
            <p style="font-size: 0.9rem; color: #ccc;">
                Print esta tela para guardar seus números ou baixe o comprovante oficial clicando no botão abaixo:
            </p>
            <button onclick="baixarComprovante()" 
                    style="width: 100%; background:#015488; color:white; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; margin-top: 10px;">
                    📥 Baixar Comprovante
            </button>
            <button onclick="modalPix.classList.add('escondido')" 
                    style="width: 100%; background:transparent; color:#888; padding:10px; border:1px solid #444; border-radius:8px; cursor:pointer; margin-top: 10px;">
                    Fechar
            </button>
        </div>
    `;
                if (intervaloTimerPix !== null) {
                    enviarEmailComprovante(nomeCompradorAtual, numeroMudou.email, numerosEmPagamento);
                    clearInterval(intervaloTimerPix);
                    intervaloTimerPix = null;
                }
            }

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

function baixarComprovante() {
    const nome = nomeCompradorAtual || "Participante"; 
    const numeros = numerosEmPagamento.map(n => String(n).padStart(3, '0')).join(', ');

    const conteudo = `
        Comprovante de Participação - Sorteio Canal Alemeras
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

async function carregarInfoSorteioPublico() {
    const { data: config, error } = await db.from('configuracoes').select('*').eq('id', 1).single();

    if (error) {
        console.error("Erro ao carregar informações do sorteio:", error);
        return;
    }

    if (config) {
        const elNome = document.getElementById('publico-nome');
        if (elNome) elNome.textContent = config.nome_sorteio || "Sorteio Atual";

        const elData = document.getElementById('publico-data');
        if (elData) elData.textContent = config.criado_em ? new Date(config.criado_em).toLocaleDateString('pt-BR') : "--/--/----";

        const elValor = document.getElementById('publico-valor');
        if (elValor) elValor.textContent = `R$ ${parseFloat(config.valor_numero).toFixed(2).replace('.', ',')}`;

        const elEstado = document.getElementById('publico-estado');
        if (elEstado) elEstado.textContent = config.estado_produto || "Não definido";
    }
}

// ==========================================
// 7. INICIALIZAÇÃO SEGURA (Window Onload)
// ==========================================
window.onload = async () => {
    console.log("Página carregada, inicializando...");
    
    await buscarConfiguracoes();
    await carregarInfoSorteioPublico();
    await carregarGrade();
    
    console.log("Sistema pronto para uso!");
};