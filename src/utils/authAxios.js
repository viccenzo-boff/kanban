import axios from 'axios';
import { getToken } from '@/utils/token';

const authAxios = async (method, url, body = {}, customHeaders = {}, contentType = 'application/json') => {
    try {
        return axios ({
            method,
            url,
            data: body,
            headers: {
                authorization: getToken(),
                'Content-Type': contentType,
                ...customHeaders
            }
        });
    } catch (error) {
        console.error('Erro ao realizar request', error);
    }
};

export default authAxios;
