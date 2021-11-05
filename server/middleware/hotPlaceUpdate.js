const parser = require("csv-parse/lib/sync");
const fs = require("fs");
const axios = require('axios');
const dbConn = require(`${process.cwd()}/dbConnection`);

module.exports = async () => {
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
            sql = 'update place set is_hot = 1 where id = ?';
            await dbConn.query(sql, [place_id]);
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

        sql = 'insert into place value (?, ?, ?, ?, ?, ?, 1, ?)';
        await dbConn.query(sql, [place_id, place.name, place.formatted_address, place.geometry.location.lat, place.geometry.location.lng, place.formatted_phone_number, parseInt(rawPlace[3])]);
    }
}