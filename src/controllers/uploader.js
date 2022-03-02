const axios = require('axios');
const WebSocketAsPromised = require('websocket-as-promised');
const WebSocket = require('ws');

module.exports.uploadToPanda = async ({
    url,
    title,
    authorization,
    folder,
    vimeo_id,
    server
}) => {
    try {

        const meta = await getMetaFile({
            url,
            server,
        });

        const hasStorage = await verifyUsageLimit({
            size: meta.data.size,
            authorization
        })
        if (!hasStorage) {
            console.log('user have reached the maximum allowed entities of this storage plan');
            return false;
        }

        const response = await upload({
            url,
            name: title,
            type: 'mp4',
            size: meta.data.size,
            authorization,
            folder,
            vimeo_id,
            server
        })

        return await webSocketConnect({
            token: response.data.token,
            server
        })
    } catch(e) {
        console.log(e, 'e')
        return false;
    }
}

const webSocketConnect = ({
    token,
    server
}) => {
    return new Promise((resolve, reject) => {
        const wsp = new WebSocketAsPromised(`wss://${server.companion.replace(/https?:\/\//g, "")}/api/${token}`, {
            createWebSocket: url => new WebSocket(url),
            extractMessageData: event => event
        });
        wsp.open()
            .then(() => {
                wsp.onMessage.addListener(data => {
                    const obj = JSON.parse(data.toString('utf8'));
                    if (obj.action === 'success') {
                        resolve(true);
                        wsp.close()
                    } else if (obj.action == 'error') {
                        resolve(false);
                        wsp.close()
                    }
                });
            })
            .catch(e => {
                resolve()
            });
    });
}

const upload = async({
    url,
    vimeo_id,
    name,
    type,
    folder,
    size,
    authorization,
    server
}) => {
    const config = {
		method: 'post',
		url: `${server.companion}/url/get`,
		headers: {
            Accept: "application/json",
            'Content-Type': 'application/json'
		},
		data: {
			endpoint: `${server.tus}/files`,
            fileId: url,
            metadata: {
                authorization,
                name,
                folder_id: folder,
                type: type,
                description: `vimeo-${vimeo_id}`
            },
            protocol: 'tus',
            size: size,
            url: url
		}
	};
	return await axios(config);
}

const getMetaFile = async ({
    url,
    server
}) => {
    const config = {
		method: 'post',
		url: `${server.companion}/url/meta`,
		headers: {
            Accept: "application/json",
            'Content-Type': 'application/json'
		},
		data: {
			url
		}
	};
	return await axios(config);
}

const verifyUsageLimit = async ({
    size,
    authorization
}) => {
    const config = {
		method: 'GET',
		url: `${process.env.PANDA_REST_API}/user/limit`,
		headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
		}
	};
	const response = await axios(config);
    const { storage_plan, storage } = response.data;
    const size_mb = (size/1024)/1024
    const new_storage = storage + (size_mb * 2)
    if (storage_plan < new_storage) {
        return false;
    }
    return true;
}
