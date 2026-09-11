const TENSPICK_API_BASE = window.TENSPICK_API_BASE || 'http://localhost/tenspickk/backend/public';

async function apiRequest(path, options = {}) {
    const cleanPath = `/${String(path).replace(/^\/+/, '')}`;
    const targetTable = cleanPath.split('/')[1] || 'leads';

    // 1. Try Supabase first if configured
    if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
            const sb = window.TenspickSupabase.getClient();
            if (sb) {
                let dbTable = targetTable;
                if (targetTable === 'client-payments') dbTable = 'client_payments';
                if (targetTable === 'staff-payments') dbTable = 'staff_payments';

                if (options.method === 'POST') {
                    const body = options.body ? JSON.parse(options.body) : {};
                    const { data, error } = await sb.from(dbTable).insert([body]).select();
                    if (!error) return { success: true, data: data ? data[0] : body, message: 'Saved successfully.' };
                } else if (options.method === 'PUT') {
                    const body = options.body ? JSON.parse(options.body) : {};
                    const id = cleanPath.split('/')[2];
                    const { data, error } = await sb.from(dbTable).update(body).eq('id', id).select();
                    if (!error) return { success: true, data: data ? data[0] : body, message: 'Updated successfully.' };
                } else if (options.method === 'DELETE') {
                    const id = cleanPath.split('/')[2];
                    const { error } = await sb.from(dbTable).delete().eq('id', id);
                    if (!error) return { success: true, message: 'Deleted successfully.' };
                } else {
                    const { data, error } = await sb.from(dbTable).select('*');
                    if (!error && Array.isArray(data)) {
                        return { success: true, data: data };
                    }
                }
            }
        } catch (sbErr) {
            console.warn("Supabase API adapter note:", sbErr);
        }
    }

    // 2. Try PHP backend if available
    try {
        const url = `${TENSPICK_API_BASE}${cleanPath}`;
        const config = {
            method: options.method || 'GET',
            credentials: 'same-origin',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? {'Content-Type': 'application/json'} : {}),
                ...(options.headers || {})
            }
        };

        const response = await fetch(url, config);
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("application/json")) {
            const data = await response.json().catch(() => null);
            if (data && data.success !== false) {
                return data;
            }
        }
    } catch (netErr) {
        console.warn("Local PHP API unreachable:", netErr);
    }

    // 3. Fallback safe mock data response for offline/static operation
    return {
        success: true,
        data: [],
        message: 'Operation completed (Offline mode).'
    };
}
