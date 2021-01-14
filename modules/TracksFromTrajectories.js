const { BasicGeodesy, Coordinate } = require("./BasicGeodesy");

const fs = require('fs');

const EARTH_RADIUS = 6371100.0;
const ARC_DEGREE_TO_METER = EARTH_RADIUS / (2.0 * Math.PI);

class TracksFromTrajectories {
   constructor(filename, options) {
       options = options ? options : {};
       this.idProperty = options.idProperty ? options.idProperty : null;
       this.headingsProperty = options.headingsProperty ? options.headingsProperty : null;
       this.mode = options.mode ? options.mode : "circle";
       this.time = options.time;
       this.filePath = filename;
       this.timeLoopIndex = 0;
       if (this.mode !== "circle") {
           this.timeLoopSpan = this.time.end -  this.time.start;
       }
       this.onReady = null;
       this.loadFile();
   }

   quickAnalisis() {
       const features = this.json.features;
       let min = null;
       let max = null;
       let points = 0;
       let pointsSimplified = 0;
       const uniqueness= {};
       const simplifiedFeatures = features.map(feature => {
           feature.active = false;
           if (min === null || feature.properties.timestamps[0] < min ) min = feature.properties.timestamps[0];
           if (max === null || feature.properties.timestamps[feature.properties.timestamps.length-1] > max ) max = feature.properties.timestamps[feature.properties.timestamps.length - 1];
           points += feature.geometry.coordinates.length;
           const simplifiedFeature =  {
               id: feature.id,
               geometry: {
                   type: feature.type,
                   coordinates: []
               },
               properties: {},
           }
           const newProperties = {};
           Object.keys(feature.properties).map(function(key, index) {
               if (key!=="timestamps" && key!=="headings") {
                   newProperties[key] = feature.properties[key];
               } else {
                   newProperties[key] = [];
               }
           });
           simplifiedFeature.properties = newProperties;
           let timestamp = null;
           for (let i=0; i< feature.properties.timestamps.length; ++i) {
               const ts = Math.floor(feature.properties.timestamps[i]);
               if (timestamp != ts) {
                   timestamp = ts;
                   simplifiedFeature.geometry.coordinates.push(feature.geometry.coordinates[i]);
                   simplifiedFeature.properties.timestamps.push(ts);
                   simplifiedFeature.properties.headings.push(feature.properties.headings[i]);
               }
           }
           pointsSimplified += simplifiedFeature.geometry.coordinates.length;
           return simplifiedFeature;
       }).filter((f)=> {
           const result = typeof this.idProperty!== "undefined" && f.properties[this.idProperty] !== undefined && f.properties[this.idProperty]!=="" ? true : false
           if (result==false) return false;
           const isUnique = typeof uniqueness[f.properties[this.idProperty]] === "undefined";
           uniqueness[f.properties[this.idProperty]] = 1;
           return isUnique;
       });
       console.log("features: " + features.length);
       console.log("features simplified: " + simplifiedFeatures.length);
       console.log("points: " + points);
       console.log("points simplified: " + pointsSimplified);
       console.log("minTime: " + min);
       console.log("maxTime: " + max);

       this.json.features = simplifiedFeatures;
       return { min: min, max: max}
   }

   loadFile() {
       fs.readFile(this.filePath, {encoding: 'utf-8'}, (err,data) => {
           if (!err) {
               this.json = JSON.parse(data);
               const interval = this.quickAnalisis();
               if (this.mode !== "circle" && this.time.auto) {
                   this.time.start = interval.min;
                   this.time.end = interval.max;
               }
               this.timeLoopSpan = this.time.end -  this.time.start;
               if (this.onReady) this.onReady();
           } else {
               console.log(err);
           }
       });
   }

   interpolateAllTracks(t, sendFunction) {
       this.timeLoopIndex %=  this.timeLoopSpan;

       const features = this.json.features;
       for (let r =0; r<features.length;++r) {
           const feature = features[r];
           const properties  = feature.properties;
           const trackIdentifier = this.idProperty ? properties[this.idProperty] : feature.id;

           const pointAndHeading = this.mode === "circle" ? this.calculatePointAndHeadingCircle(feature, t) : this.calculatePointAndHeadingTimeLoop(feature, this.timeLoopIndex) ;

           const newProperties = {};
           Object.keys(properties).map(function(key, index) {
               if (key!=="timestamps" && key!=="headings") newProperties[key] = properties[key];
           });
           newProperties.heading = this.headingsProperty == null ? pointAndHeading.angle : properties[this.headingsProperty][pointAndHeading.index];

           if (pointAndHeading.inRange === 0) {
               const trackMessage = {
                   "action": "PUT",
                   "geometry": pointAndHeading.point,
                   id: trackIdentifier,
                   properties: newProperties
               }
               sendFunction(trackMessage);
           } else {
               if (feature.active) {
                   feature.active = false;
                   const trackMessage = {
                       "action": "DELETE",
                       id: trackIdentifier,
                       properties: newProperties
                   }
                   sendFunction(trackMessage);
               }
           }
       }
       this.timeLoopIndex ++;
   }

    calculatePointAndHeadingCircle(feature, t) {
        const properties = feature.properties;

        const geometry = feature.geometry;
        const coordinates = geometry.coordinates;
        const timestamps = properties.timestamps;
        const maxTime = timestamps[timestamps.length-1];
        const localizedTime = t % maxTime;
        const index = TracksFromTrajectories.searchIndex(localizedTime, timestamps);

        const leftIndex = index;
        const  rightIndex = (index + 1) % timestamps.length;
        const leftTimeStamp = timestamps[leftIndex];
        let rightTimeStamp = timestamps[rightIndex];
        if (rightIndex < leftIndex) {
            rightTimeStamp += timestamps[timestamps.length-1];
        }
        const fraction = 1.0 *  (localizedTime - leftTimeStamp) / (rightTimeStamp-leftTimeStamp);

        const coordinateA = new Coordinate(coordinates[leftIndex]);
        const coordinateB = new Coordinate(coordinates[rightIndex]);
        const coordinate = BasicGeodesy.PointInLineGreatCircle(coordinateA, coordinateB, fraction);
        const angle = BasicGeodesy.forwardAzimuth2D(coordinateA, coordinateB);
        const point = {
            type: "Point",
            coordinates: coordinate.getAsArray()
        }
        return { point:point, angle:angle, inRange: 0, index: leftIndex};
    }

    calculatePointAndHeadingTimeLoop(feature, t) {
        const currentTime = t + this.time.start;

        const properties = feature.properties;
        const geometry = feature.geometry;
        const coordinates = geometry.coordinates;
        const timestamps = properties.timestamps;
        const minTime = timestamps[0];
        const maxTime = timestamps[timestamps.length-1];

        if (currentTime < minTime) {
            const point = {
                type: "Point",
                coordinates: geometry.coordinates[0]
            }
            return { point:point, angle:0, inRange: -1, index: 0 };
        } else if (currentTime > maxTime) {
            const point = {
                type: "Point",
                coordinates: geometry.coordinates[geometry.coordinates.length-1]
            }
            return { point:point, angle:0, inRange: 1, index: geometry.coordinates.length-1 };
        } else {
            feature.active =  true;
            const localizedTime = currentTime;
            const index = TracksFromTrajectories.searchIndex(localizedTime, timestamps);

            const leftIndex = index;
            const  rightIndex = (index + 1) % timestamps.length;
            const leftTimeStamp = timestamps[leftIndex];
            let rightTimeStamp = timestamps[rightIndex];
            if (rightIndex < leftIndex) {
                rightTimeStamp += timestamps[timestamps.length-1];
            }

            if (rightTimeStamp-leftTimeStamp == 0 ) {
                const point = {
                    type: "Point",
                    coordinates: geometry.coordinates[leftIndex]
                }
                return { point:point, angle:0, inRange: 0 };
            }

            const fraction = 1.0 *  (localizedTime - leftTimeStamp) / (rightTimeStamp-leftTimeStamp);
            const coordinateA = new Coordinate(coordinates[leftIndex]);
            const coordinateB = new Coordinate(coordinates[rightIndex]);
            const coordinate = BasicGeodesy.PointInLineGreatCircle(coordinateA, coordinateB, fraction);
            const angle = BasicGeodesy.forwardAzimuth2D(coordinateA, coordinateB);
            const point = {
                type: "Point",
                coordinates: coordinate.getAsArray()
            }
            return { point:point, angle:angle, inRange: 0, index: leftIndex };
        }
    }

     static  searchIndex( value,  a) {
        if(value < a[0]) {
            return 0;
        }
        if(value > a[a.length-1]) {
            return a.size()-1;
        }

        let lo = 0;
        let hi = a.length - 1;

        while (lo <= hi) {
            const mid = Math.floor((hi + lo) / 2);
            if (value < a[mid]) {
                hi = mid - 1;
            } else if (value > a[mid]) {
                lo = mid + 1;
            } else {
                return mid;
            }
        }
        return hi;
    }

}

module.exports = TracksFromTrajectories;
