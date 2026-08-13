const routes = {
    public: [
        '/',
        '/sobre',
        '/documentacao'
    ],
    guest: [
        '/usuarios/login',
        '/usuarios/novo',
    ],
};

const hasRouteAccess = (isAuthenticated, route) => {
    try {
        const isPublicRoute = routes.public.includes(route);
        const isGuestRoute = routes.guest.includes(route);

        // Se é rota pública => sim
        if (isPublicRoute) return true;

        // Se tá logado e é rota de convidado => não
        if (isAuthenticated && isGuestRoute) return false;

        // Se não tá logado e não é rota de convidado => não
        if(!isAuthenticated && !isGuestRoute) return false;

        return true;

    } catch (error) {
        console.error(`Erro na verificação de rota ${route}`, error);
        return false;
    }
};

export default hasRouteAccess;