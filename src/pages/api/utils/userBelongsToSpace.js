import db from '@/pages/api/config/connectDB';

const userBelongsToSpace = async (idEspaco, idUser) => {
    const client = await db.connect();
    try {
        const id_espaco = Number(idEspaco);
        const id_user = Number(idUser);

        if(!Number.isInteger(id_espaco) ||  !Number.isInteger(id_user)){
            throw new Error('IDs de espaço e usuário devem ser números inteiros: ', idEspaco, idUser);
        }

        const espacoPromise = client.query({ text: `SELECT * FROM espaco WHERE id = $1`, values:[id_espaco] });
        const vinculoPromise = client.query({ text: `SELECT id FROM espaco_usuario WHERE id_espaco = $1 AND id_usuario = $2 AND ativo = TRUE LIMIT 1`, values:[id_espaco, id_user] });

        const [espacoResult, vinculoResult] = await Promise.all([espacoPromise, vinculoPromise]);

        // Espaço não encontrado
        if(espacoResult.rowCount !== 1){
            return {
                error: false,
                belongs: false,
                espaco: null,
            };
        }

        const espaco = espacoResult.rows[0];

        // Usuário é dono do espaço
        if(espaco.id_usuario == id_user){
            return {
                error: false,
                belongs: true,
                espaco: espaco,
            }
        }

        // Usuário não pertence ao espaço
        if(vinculoResult.rowCount !== 1){
            return {
                error: false,
                belongs: false,
                espaco: espaco,
            }
        }

        // Usuário pertence ao espaço
        return {
            error: false,
            belongs: true,
            espaco: espaco,
        }
    } catch (error) {
        console.log('Erro ao verificar permissões de usuário: ', error);
        return {
            error: true,
            belongs: false,
            espaco: null,
        }
    } finally {
        client.release();
    }
};

export default userBelongsToSpace;