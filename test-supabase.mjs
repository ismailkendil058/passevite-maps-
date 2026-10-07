import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://gyiqvpudqowixwakxqis.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aXF2cHVkcW93aXh3YWt4cWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTc0MzUsImV4cCI6MjA4ODU5MzQzNX0.SVMtdSfQ0xD7MCz-Gqm-KXHl9IuU28-8xqvbPIFPR-w";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function test() {
    const { data, error } = await supabase.from('sessions').insert({ opened_by: '9c2f6d21-f094-4d83-93d3-73d8f85f57bb' }).select();
    console.log("Error:", error);
    console.log("Data:", data);
}
test();
