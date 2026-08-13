import db from '@/pages/api/config/connectDB';
import buildInsert from '../utils/buildInsert';

import defaultResponse from '../config/defaultResponse';
import authMiddleware from '../config/middlewares/authMiddleware';
import getTableColumns from '../utils/getTableColumns';

const handler = async (req, res) => {
    try {
        const tableName = 'espaco';
        const user = req.user;
        const data = req.body ?? {};
        const requiredData = {
            nome: 'Nome',
            descricao: 'Descrição',
            sigla: 'Sigla',
            icon: 'Ícone'
        };
        const missingData = !Object.keys(requiredData).every(key => data[key]);
        const extraData = Object.keys(data).every(key => !requiredData[key]);
        const dbColumns = await getTableColumns(tableName);

        if(missingData){
            return res.status(400).json(defaultResponse('Preencha todos os dados para continuar'));
        }

        if(extraData){
            return res.status(400).json(defaultResponse(`Preencha apenas ${Object.keys(requiredData).join(', ')}`));
        }

        // Checando tamanho máximo das strings
        for(const requiredKey in requiredData) {

            const column = dbColumns.find(col => col.column_name == requiredKey);
            const maxLength = column.character_maximum_length;

            if(data[requiredKey].length > maxLength){
                return res.status(400).json(defaultResponse(`${requiredData[requiredKey]} deve ter no máximo ${maxLength} caracteres`));
            }
        }

        data.id_usuario = user.id;

        const insertData = buildInsert(tableName, data);

        const spaceResult = await db.query({ text: insertData.text, values: insertData.values});

        if(spaceResult.rowCount !== 1){
            return res.status(500).json(defaultResponse('Espaço não criado. Contate o suporte'));
        }

        const space = spaceResult.rows[0];

        return res.status(201).json(defaultResponse('Espaço criado', space));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse('Erro ao criar espaço'));;
    }
};

export default authMiddleware(handler);