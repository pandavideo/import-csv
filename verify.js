const csv = require('async-csv');
const fs = require('fs').promises;
const dotenv = require('dotenv');
dotenv.config();

const {
    getVideos
} = require('./src/controllers/videos')

const FILE = process.env.FILE;

(async ({
    file,
}) => {
    try {
        const csvString = await fs.readFile(`./${file}`, 'utf-8');
        const rows = await csv.parse(csvString,{delimiter:';'})
        const data = Object.values(rows).slice(1)
        console.log('DATA',data.length)
        const videos = await getVideos({
            authorization: process.env.API_KEY,
            limit: 20000
        });

        for await (let value of data) {
            const [video_uri,name,type,quality,file_type,expires,link,size_short ] = value;
            const vimeo_id = video_uri.replace('/videos/','')
            const [ video ]  = videos.filter(v => v.description === `vimeo-${vimeo_id}`);
            if (video) {
                if (video.status != 'CONVERTED' && video.status != 'CONVERTING') {
                    console.log(`ID: ${vimeo_id} Status: ${video.status} Name: ${name}`)
                }
            } else {
                console.log(`Not found ID: ${vimeo_id} Name: ${name}`)
            }
        }
    } catch(e) {
        console.log(e, 'err')
    }
})({
    file: FILE,
})