/* ============================================================
 * TENSPICK CRM
 * SUPABASE CLIENT ADAPTER
 * ============================================================ */

(function (window) {
  "use strict";

  const SUPABASE_URL = window.TENSPICK_SUPABASE_URL || localStorage.getItem('TENSPICK_SUPABASE_URL') || '';
  const SUPABASE_ANON_KEY = window.TENSPICK_SUPABASE_ANON_KEY || localStorage.getItem('TENSPICK_SUPABASE_ANON_KEY') || '';

  let client = null;

  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  window.TenspickSupabase = {
    isConfigured: function () {
      return !!client || (!!SUPABASE_URL && !!SUPABASE_ANON_KEY);
    },
    getClient: function () {
      if (!client && (window.TENSPICK_SUPABASE_URL || localStorage.getItem('TENSPICK_SUPABASE_URL')) && window.supabase) {
        const url = window.TENSPICK_SUPABASE_URL || localStorage.getItem('TENSPICK_SUPABASE_URL');
        const key = window.TENSPICK_SUPABASE_ANON_KEY || localStorage.getItem('TENSPICK_SUPABASE_ANON_KEY');
        client = window.supabase.createClient(url, key);
      }
      return client;
    },
    configure: function (url, key) {
      localStorage.setItem('TENSPICK_SUPABASE_URL', url);
      localStorage.setItem('TENSPICK_SUPABASE_ANON_KEY', key);
      if (window.supabase) {
        client = window.supabase.createClient(url, key);
      }
    }
  };
})(window);
