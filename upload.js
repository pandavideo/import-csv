const csv = require('async-csv');
const fs = require('fs').promises;
const dotenv = require('dotenv');
dotenv.config();
const [CONCURRENT_UPLOADS = 5 ] = process.argv.slice(2);


const {
    uploadToPanda,
} = require('./src/controllers/uploader')
const {
    getVideos
} = require('./src/controllers/videos')

const FILE = process.env.FILE;
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
(async ({
    file,
    concurrent,
}) => {
    let count=0
    let current_uploads = []
    const companions = process.env.COMPANION_ENDPOINT.split(',')
    const tus_servers = process.env.TUSD_ENDPOINT.split(',')
    const servers = companions.map((item,index)=>({companion:item,tus:tus_servers[index]}))
    try {
        const videos = await getVideos({
            authorization: process.env.API_KEY,
            limit: 50000
        });
        const csvString = await fs.readFile(`./${file}`, 'utf-8');

        const rows = await csv.parse(csvString,{delimiter:';'})
        const data = Object.values(rows).slice(1)
        let best_files_object = {}
        for (let value of data) {
            const [video_uri,name,type,quality,file_type,expires,link,size_short ] = value;
            const vimeo_id = video_uri.replace('/videos/','')
            const existent_video = videos.find(video=>{
                if(!video.description) return false
                const panda_vimeo_id = video.description.replace('vimeo-','')
                return panda_vimeo_id===vimeo_id
            });
            if(existent_video) {
                continue
            }
            if(!best_files_object[vimeo_id] || file_type==='source' || quality==='source'){
                best_files_object[vimeo_id] = {name,quality,link,vimeo_id}
                continue
            }
            if(best_files_object[vimeo_id].quality ==='sd' && quality==='hd'){
                best_files_object[vimeo_id] = {name,quality,link,vimeo_id}
                continue
            }
        }
        
        let best_files = Object.keys(best_files_object).map(item=>best_files_object[item])
        console.log(`UPLOADS: ${best_files.length}\n\n`)
        function run(){
            if(concurrent>current_uploads.length){
                if(!best_files) return
                const to_upload = best_files.find(item=>{
                    if(item.uploaded) return false
                    const already_uploading = current_uploads.find(item2=>item2.vimeo_id===item.vimeo_id)
                    return !already_uploading
                })
                if(!to_upload){
                    return
                }
                count++
                current_uploads.push(to_upload)
                upload_video(to_upload)
            }
            setTimeout(run,500)
        }
        async function upload_video(video){
            const {name,link,vimeo_id} = video;
            
            if (!link) {
                console.log('WITHOUT LINK')
                return
            }

            const server = servers[getRandomInt(servers.length)]
            console.log(`${count} - ${vimeo_id}\n${name} \n${server.tus}\n\n`);
            const resUpload = await uploadToPanda({
                url: link,
                title: `${name} ${vimeo_id}`,
                authorization: process.env.API_KEY,
                folder: process.env.FOLDER_ID,
                vimeo_id,
                server
            });
            
            if (!resUpload) {
                console.log('\n\nerr upload file', link, name, vimeo_id)
            }else{
                best_files = best_files.filter(item=>item.vimeo_id!==video.vimeo_id)
                current_uploads = current_uploads.filter(item=>item.vimeo_id!==video.vimeo_id)
            }
        }
        run()

    } catch(e) {
        console.log(e, 'err')
    }
})({
    file: FILE,
    concurrent: CONCURRENT_UPLOADS
})