const tokenName = 'kanban-token';

const getToken = () => {
    return localStorage.getItem(tokenName);
};

const removeToken = () => {
    try {
        localStorage.removeItem(tokenName);

        return true;
    } catch (error) {
        console.error('Erro ao remover token');
        return false;
    }
};

const setToken = (token) => {
    try {
        localStorage.setItem(tokenName, token);

        return true;
    } catch (error) {
        console.error('Erro ao armazenar token');
        
        return false;
    }
};

export { getToken, removeToken, setToken };