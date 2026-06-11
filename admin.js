// Conexão rápida (use as mesmas chaves do seu script.js)
const supabaseUrl = "https://wfnimuncbyvfglhbqjtj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbmltdW5jYnl2ZmdsaGJxanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTkwMzIsImV4cCI6MjA5NjE5NTAzMn0.Q9GD87K1hQ0IYzN0sXuKOUWBvbXT9-K0DhWorIJwDdw";
const db = supabase.createClient(supabaseUrl, supabaseKey);

async function carregarVendas() {
    const { data, error } = await db
        .from('sorteio')
        .select('*')
        .eq('status', 'pago');

    if (error) return console.error(error);

    // Lógica para agrupar números do mesmo comprador
    const vendasAgrupadas = data.reduce((acc, item) => {
        const chave = item.nome_comprador + item.whatsapp; // Identificador único
        if (!acc[chave]) {
            acc[chave] = { ...item, numeros: [item.id] };
        } else {
            acc[chave].numeros.push(item.id);
        }
        return acc;
    }, {});

    const listaFinal = Object.values(vendasAgrupadas);

    const tbody = document.getElementById('tabela-admin');
    tbody.innerHTML = listaFinal.map(item => `
        <tr>
            <td>${item.numeros.sort((a,b) => a-b).map(n => String(n).padStart(3, '0')).join(', ')}</td>
            <td>${item.nome_comprador}</td>
            <td>${item.whatsapp}</td>
            <td>${item.email}</td>
            <td>${item.mensagem_live || ''}</td>
        </tr>
    `).join('');
}

carregarVendas();