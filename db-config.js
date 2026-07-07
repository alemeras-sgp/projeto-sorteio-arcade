// Conexão rápida (use as mesmas chaves do seu script.js)
const supabaseUrl = "https://wfnimuncbyvfglhbqjtj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbmltdW5jYnl2ZmdsaGJxanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTkwMzIsImV4cCI6MjA5NjE5NTAzMn0.Q9GD87K1hQ0IYzN0sXuKOUWBvbXT9-K0DhWorIJwDdw";
const db = supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase inicializado com sucesso!");