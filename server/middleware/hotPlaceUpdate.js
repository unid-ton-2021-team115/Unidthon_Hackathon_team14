const parser = require("csv-parse/lib/sync");
const fs = require("fs");
const axios = require('axios');
const dbConn = require(`${process.cwd()}/dbConnection`);
const {JSDOM} = require('jsdom');
const {window}=new JSDOM('');
const $ = require('jquery')(window);

const type2kor = {
    amusement_park: '문화',
    aquarium: '문화',
    art_gallery: '문화',
    bakery: '디저트',
    bar: '술집',
    book_store: '서점',
    cafe: '디저트',
    campground: '캠핑장',
    church: '교회',
    clothing_store: '상점',
    gym: '체육관',
    hair_care: '헤어샵',
    library: '도서관',
    movie_theater: '영화관',
    museum: '문화',
    night_club: '클럽',
    park: '공원',
    restaurant: '식당',
    school: '학교',
    shoe_store: '쇼핑',
    shopping_mall: '쇼핑',
    spa: '스파',
    stadium: '문화',
    store: '상점',
    supermarket: '쇼핑',
    tourist_attraction: '문화',
    university: '학교',
    zoo: '동물원',
};


module.exports = async () => {


// $.ajax({
//     type: "post",
//                  url: `${process.cwd()}/../web-scraping/instagram-scraping.py`,
//     data: { email: 'mskim9967', password: 'imasms4158' }
//           }).done(async function(o) {
//     const csv = fs.readFileSync(`${process.cwd()}/../web-scraping/instagram_web_scraping.csv`);
// const rawPlaces = parser(csv.toString("utf-8"));

    const csv = fs.readFileSync(`${process.cwd()}/instagram_web_scraping.csv`);
    const rawPlaces = parser(csv.toString("utf-8"));

    let sql = 'update place set is_hot = 0';
    await dbConn.query(sql, []);

    for(let rawPlace of rawPlaces) {
        if(rawPlace[0] === 'district') continue;
        let place_id = await axios.get('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', {
            params : {
                input : rawPlace[1],
                inputtype : 'textquery',
                key : process.env.GOOGLE_MAP_API_KEY
            }
        });
        if(place_id.data.status != "OK") continue;
        place_id = place_id.data.candidates[0].place_id;

        sql = 'select * from place where id = ?';
        let [check] = await dbConn.query(sql, [place_id]);
        if(check.length){
            sql = 'update place set is_hot = 1 and recent_post_cnt = ? where id = ?';
            await dbConn.query(sql, [rawPlace[3], place_id]);
            continue;
        }

        let place = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params : {
                fields : 'formatted_address,name,geometry,types,formatted_phone_number',
                place_id,
                language: 'ko',
                key : process.env.GOOGLE_MAP_API_KEY
            }
        });
        place = place.data.result;

        let typeNotMatched = true;
        for(type of place.types)
            if(type2kor[type]) typeNotMatched = false;
        if(typeNotMatched) continue;

        sql = 'insert into place value (?, ?, ?, ?, ?, ?, 1, ?)';
        await dbConn.query(sql, [place_id, place.name, place.formatted_address, place.geometry.location.lat, place.geometry.location.lng, place.formatted_phone_number, parseInt(rawPlace[3])]);

        for(type of place.types) {
            if(!type2kor[type]) continue;
            sql = 'insert into place_types value (null, ?, ?)';
            await dbConn.query(sql, [place_id, type2kor[type]]);
        }
    }
}