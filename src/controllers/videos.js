const axios = require('axios');

module.exports.getVideos =  async ({
    limit,
    authorization
}) => {
    const config = {
		method: 'GET',
		url: `${process.env.PANDA_REST_API}/videos?limit=${limit}`,
		headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
		}
	};
	const response = await axios(config);
    const { videos } = response.data;
    return videos;
}