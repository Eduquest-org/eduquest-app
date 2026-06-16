const Storage = {
    saveSession(sessionData) {
        localStorage.setItem('eduquest_session', JSON.stringify(sessionData));
    },

    getSession() {
        const data = localStorage.getItem('eduquest_session');
        return data ? JSON.parse(data) : null;
    },

    removeSession() {
        localStorage.removeItem('eduquest_session');
    }
};