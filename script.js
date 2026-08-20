// ==========================================
// 1. VARIÁVEIS E ELEMENTOS DA TELA
// ==========================================

let nomeCompradorAtual = "";
let VALOR_POR_NUMERO = 1;

const gridNumeros = document.getElementById('grid-numeros');
const btnComprar = document.getElementById('btn-comprar');
const qtdSelecionadosSpan = document.getElementById('qtd-selecionados');
const modalCheckout = document.getElementById('modal-checkout');
const fecharModal = document.getElementById('fechar-modal');
const resumoNumeros = document.getElementById('resumo-numeros');
let numerosSelecionados = [];
const modalPix = document.getElementById('modal-pix');
const fecharModalPix = document.getElementById('fechar-modal-pix');
let imgQrcode = document.getElementById('img-qrcode');
let inputCopiaCola = document.getElementById('input-copiacola');
let btnCopiar = document.getElementById('btn-copiar');

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
// 5. ENVIANDO DADOS PARA O BANCO E GERANDO PREFERÊNCIA DO PIX
// ==========================================

let numerosEmPagamento = [];

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
            .eq('status', 'reservado');
    }
}

function iniciarCronometroPix() {
    let tempo = TEMPO_LIMITE_PIX * 60;

    const spanTempoRestante = document.getElementById('tempo-restante');
    if (spanTempoRestante) {
        const minInicial = String(Math.floor(tempo / 60)).padStart(2, '0');
        const segInicial = String(tempo % 60).padStart(2, '0');
        spanTempoRestante.textContent = `${minInicial}:${segInicial}`;
    }

    clearInterval(intervaloTimerPix);

    intervaloTimerPix = setInterval(async () => {
        tempo--;
        const minutos = String(Math.floor(tempo / 60)).padStart(2, '0');
        const segundos = String(tempo % 60).padStart(2, '0');

        if (spanTempoRestante) {
            spanTempoRestante.textContent = `${minutos}:${segundos}`;
        }

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

if (campoMensagem && contadorMsg) {
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
}

// --- SUBMISSÃO DO FORMULÁRIO ---
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
    const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
    const msgTexto = document.getElementById('mensagem').value;
    const msg = `${msgTexto}`;

    const idsParaAtualizar = numerosSelecionados.map(num => parseInt(num, 10));
    const totalCompra = numerosSelecionados.length * VALOR_POR_NUMERO;
    const valorFormatado = parseFloat(totalCompra.toFixed(2));

    numerosEmPagamento = [...idsParaAtualizar];

    try {
        console.log("1. Verificando disponibilidade dos números...");
        const { data: checagem, error: erroChecagem } = await db
            .from('sorteio')
            .select('id, status')
            .in('id', idsParaAtualizar);

        if (erroChecagem) throw erroChecagem;

        const numerosRoubados = checagem.filter(num => num.status !== 'disponivel');

        if (numerosRoubados.length > 0) {
            const nomesRoubados = numerosRoubados.map(n => String(n.id).padStart(3, '0')).join(', ');
            alert(`⚠️ Ops! O(s) número(s) ${nomesRoubados} já foi(ram) escolhido(s). Escolha outro(s).`);
            carregarGrade();
            modalCheckout.classList.add('escondido');
            btnConfirmar.textContent = textoOriginalBotao;
            btnConfirmar.disabled = false;
            return;
        }

        console.log("Gerando PIX direto no servidor...");
        const { data: dadosPix, error: erroFuncao } = await db.functions.invoke('gerar-pix', {
            body: {
                valor: valorFormatado,
                email: email,
                nome: nome,
                cpf: cpf,
                ids: idsParaAtualizar
            }
        });

        // 1. MUDANÇA AQUI: Agora validamos se o QR Code chegou, e não mais a preferência
        if (erroFuncao || !dadosPix?.qr_code_base64) {
            throw new Error(`Erro na geração do PIX: ${erroFuncao?.message || 'QR Code não retornado. Verifique o CPF.'}`);
        }

        console.log("Travando os números no banco como 'reservado'...");
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
            alert(`⚠️ Que azar terrível! Outra pessoa finalizou a compra de um número que você escolheu milissegundos antes, volte e escolha outros números`);
            carregarGrade();
            modalCheckout.classList.add('escondido');
            btnConfirmar.textContent = textoOriginalBotao;
            btnConfirmar.disabled = false;
            return;
        }

        // Atualização visual imediata da grade
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

        // 2. MUDANÇA AQUI: Renderiza o QR Code direto na imagem, sem Brick!
        if (imgQrcode && inputCopiaCola) {
            imgQrcode.src = `data:image/jpeg;base64,${dadosPix.qr_code_base64}`;
            imgQrcode.style.display = 'inline-block';
            inputCopiaCola.value = dadosPix.qr_code;
        }

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

    // Restaura o HTML original do modal (AGORA COM A IMAGEM DO QR CODE)
    const modalContent = modalPix.querySelector('.modal-content');
    modalContent.innerHTML = `
        <span id="fechar-modal-pix" class="fechar">&times;</span>
        <h2>Pagamento via Pix</h2>
        <p style="color: #a8a8b3; margin-bottom: 1rem;">Escaneie o QR Code ou copie o código abaixo.</p>

        <div class="qr-code-container">
            <img id="img-qrcode" src="" alt="QR Code Pix"
                style="max-width: 250px; border-radius: 8px; margin: 15px 0; border: 4px solid #fff; display: none;">
        </div>

        <div class="form-group" style="text-align: left;">
            <label>Pix Copia e Cola:</label>
            <input type="text" id="input-copiacola" readonly>
            <button type="button" id="btn-copiar" class="btn-confirmar" style="margin-top: 10px;">Copiar Código Pix</button>
        </div>

        <p style="font-size: 1.5rem; font-weight: bold; color: #ff4747; margin-top: 15px;">Tempo restante: <span id="tempo-restante">10:00</span></p>

        <p id="status-pagamento"
            style="color: #e1a000; margin-top: 15px; font-weight: bold; animation: pulse 2s infinite;">⏳ Aguardando pagamento...</p>
    `;

    // Re-vincula os eventos aos novos elementos do HTML
    imgQrcode = document.getElementById('img-qrcode');
    inputCopiaCola = document.getElementById('input-copiacola');
    btnCopiar = document.getElementById('btn-copiar');
    
    document.getElementById('fechar-modal-pix').addEventListener('click', fecharModalPixELimparEstado);

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

    const camposParaLimpar = ['nome', 'email', 'cpf', 'mensagem'];
    camposParaLimpar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });
}

fecharModalPix.addEventListener('click', fecharModalPixELimparEstado);

window.addEventListener('click', function (event) {
    if (event.target === modalPix) {
        fecharModalPixELimparEstado();
    }
});

// Evento de Copiar o Pix
if (btnCopiar) {
    btnCopiar.addEventListener('click', () => {
        if (inputCopiaCola) {
            inputCopiaCola.select();
            document.execCommand('copy');
            const textoAntigo = btnCopiar.textContent;
            btnCopiar.textContent = 'Copiado!';
            btnCopiar.style.backgroundColor = '#00875f';
            setTimeout(() => {
                btnCopiar.textContent = textoAntigo;
                btnCopiar.style.backgroundColor = '#8257e5';
            }, 2000);
        }
    });
}

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
// REALTIME SEGURO (Iniciado após o carregamento)
// ==========================================
function iniciarRealtime() {
    // Sincronização de Configurações
    db.channel('mudancas_config')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracoes' }, payload => {
            console.log("Mudança detectada, atualizando informações...");
            carregarInfoSorteioPublico();
            location.reload();
        })
        .subscribe();

    // Sincronização do Sorteio
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
                            <div style="font-size: 1.5rem; font-weight: bold; margin: 15px 0; color: #015488;">
                                ${numerosComprados}
                            </div>
                            <p style="font-size: 0.9rem; color: #ccc;">
                                Baixe o comprovante oficial clicando no botão abaixo:
                            </p>
                            <button onclick="baixarComprovante()" 
                                    style="width: 100%; background:#015488; color:white; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; margin-top: 10px;">
                                    📥 Baixar Comprovante
                            </button>
                            <button onclick="fecharModalPixELimparEstado()" 
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
}



// ==========================================
// 7. INICIALIZAÇÃO SEGURA (Window Onload)
// ==========================================
window.onload = async () => {
    console.log("Página carregada, inicializando...");

    try {
        await buscarConfiguracoes();
        await carregarInfoSorteioPublico();
        await carregarGrade();
        iniciarRealtime();
        console.log("Sistema pronto para uso!");
    } catch (erro) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO:", erro);
        alert("Erro ao carregar o sistema. Verifique o console (F12).");
    }
};