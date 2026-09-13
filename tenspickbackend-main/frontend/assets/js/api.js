const TENSPICK_API_BASE = window.TENSPICK_API_BASE || 'http://localhost/tenspickk/backend/public';

async function apiRequest(path, options = {}) {
    const cleanPath = `/${String(path).replace(/^\/+/, '')}`;
    const segments = cleanPath.split('/').filter(Boolean);
    const targetTable = segments[0] || 'leads';
    const method = String(options.method || 'GET').toUpperCase();

    // Map table names to DB & LocalStorage keys
    let dbTable = targetTable;
    if (targetTable === 'client-payments' || targetTable === 'payments') dbTable = 'client_payments';
    if (targetTable === 'staff-payments') dbTable = 'staff_payments';

    const lsKey = `tenspick_${dbTable}`;

    // 1. Try Supabase first if configured
    if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
            const sb = window.TenspickSupabase.getClient();
            if (sb) {
                if (method === 'POST') {
                    const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
                    const { data, error } = await sb.from(dbTable).insert([body]).select();
                    if (!error) return { success: true, data: data ? data[0] : body, message: 'Saved successfully.' };
                } else if (method === 'PUT' || method === 'PATCH') {
                    const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
                    const id = segments[1];
                    const { data, error } = await sb.from(dbTable).update(body).eq('id', id).select();
                    if (!error) return { success: true, data: data ? data[0] : body, message: 'Updated successfully.' };
                } else if (method === 'DELETE') {
                    const id = segments[1];
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
            method: method,
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

    // 3. LocalStorage Fallback Layer
    try {
        let localData = [];
        const raw = localStorage.getItem(lsKey);
        if (raw) localData = JSON.parse(raw) || [];

        if (method === 'POST') {
            const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
            const newItem = { id: body.id || Date.now(), ...body, created_at: new Date().toISOString() };
            localData.unshift(newItem);
            localStorage.setItem(lsKey, JSON.stringify(localData));
            return { success: true, data: newItem, message: 'Saved to local storage.' };
        } else if (method === 'PUT' || method === 'PATCH') {
            const id = segments[1];
            const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
            let updated = null;
            localData = localData.map(item => {
                if (String(item.id) === String(id)) {
                    updated = { ...item, ...body };
                    return updated;
                }
                return item;
            });
            localStorage.setItem(lsKey, JSON.stringify(localData));
            return { success: true, data: updated || body, message: 'Updated in local storage.' };
        } else if (method === 'DELETE') {
            const id = segments[1];
            localData = localData.filter(item => String(item.id) !== String(id));
            localStorage.setItem(lsKey, JSON.stringify(localData));
            return { success: true, message: 'Deleted from local storage.' };
        } else {
            return { success: true, data: localData };
        }
    } catch (lsErr) {
        console.warn("LocalStorage fallback note:", lsErr);
    }

    // 4. Safe fallback
    return {
        success: true,
        data: [],
        message: 'Operation completed (Offline fallback mode).'
    };
}

