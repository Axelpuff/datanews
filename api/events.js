import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { category, limit } = req.query;
      let query = supabase.from('events').select('*').order('timestamp', { ascending: false });
      if (category) query = query.eq('category', category);
      if (limit) query = query.limit(parseInt(limit));
      else query = query.limit(50);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { headline, source_url, source_name, category, location_lat, location_lon, location_name, is_primary_source, llm_summarized, llm_model, event_type } = req.body;
      const { data, error } = await supabase
        .from('events')
        .insert({ headline, source_url, source_name, category, location_lat, location_lon, location_name, is_primary_source, llm_summarized, llm_model, event_type })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}