import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, country_code } = await req.json();

    if (!phone_number || !country_code) {
      return new Response(
        JSON.stringify({ error: "Missing phone_number or country_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number - remove leading zeros
    const normalizedPhone = phone_number.replace(/^0+/, "");

    console.log(`Checking if user exists: ${country_code}${normalizedPhone}`);

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", normalizedPhone)
      .eq("country_code", country_code)
      .limit(1);

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exists = profiles && profiles.length > 0;
    console.log(`User exists: ${exists}`);

    return new Response(
      JSON.stringify({ exists }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
