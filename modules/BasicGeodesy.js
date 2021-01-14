const EARTH_RADIUS = 6371100.0;
const ARC_DEGREE_TO_METER = EARTH_RADIUS / (2.0 * Math.PI);

class BasicGeodesy {
    // Calculate the azimjut between 2 points.
    static forwardAzimuth2D(aP1, aP2) {
        const lon1 = BasicGeodesy.toRadians(aP1.x);
        const lat1 = BasicGeodesy.toRadians(aP1.y);
        const lon2 = BasicGeodesy.toRadians(aP2.x);
        const lat2 = BasicGeodesy.toRadians(aP2.y);
        const dlonrad = lon2 - lon1;
        const cosdlon = Math.cos(dlonrad);
        const sindlon = Math.sin(dlonrad);
        const base = Math.atan2(Math.sin(lat1) * cosdlon - Math.cos(lat1) * (Math.sin(lat2) / Math.cos(lat2)), sindlon);
        let azimuth = Math.PI / 2.0 + base;
        if (azimuth < 0.0) {
            azimuth += 2.0 * Math.PI;
        }
        return BasicGeodesy.toDegrees(azimuth);
    }

    // Converts a value from radians to degrees
    static toDegrees(radians) {
        return radians * 180/Math.PI;
    }

    // Converts a value from degrees to radians
    static toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // Calculate a point along the line defined by coordinateP1, coordinateP2 defined by ratio, where ration is a value between 0 and 1.
    static PointInLineGreatCircle(coordinateP1, coordinateP2, aRatio) {
        let lambda;
        let phi;
        const z = typeof coordinateP1.z !== "undefined" && typeof coordinateP2.z !== "undefined" ?
            coordinateP1.z + (coordinateP2.z - coordinateP1.z) * aRatio + 400 * Math.sin(Math.PI * aRatio) : undefined;

        if (Math.abs(aRatio) < 1e-12) {
            phi = coordinateP1.y;
            lambda = coordinateP1.x;
            return new Coordinate(lambda, phi, z);
        } else if (Math.abs(aRatio - 1.0) < 1e-12) {
            phi = coordinateP2.y;
            lambda = coordinateP2.x;
            return new Coordinate(lambda, phi, z);
        } else {
            const d = aRatio * BasicGeodesy.TwoPointsGreatCircleDistance(coordinateP1, coordinateP2) / ARC_DEGREE_TO_METER;
            const a = BasicGeodesy.forwardAzimuth2D(coordinateP1, coordinateP2);

            const azimuth_rad = BasicGeodesy.toRadians(a);
            const  arcdist_rad = d;
            const sin_dist = Math.sin(arcdist_rad);
            const cos_dist = Math.cos(arcdist_rad);

            const sinY = Math.sin(BasicGeodesy.toRadians(coordinateP1.y));
            const cosY = Math.cos(BasicGeodesy.toRadians(coordinateP1.y));
            const sin_phi = Math.cos(azimuth_rad) * cosY * sin_dist + cos_dist * sinY;
            const phi_rad = Math.asin(sin_phi);

            const sin_dlon = Math.sin(azimuth_rad) * sin_dist;
            const cos_dlon = (cos_dist - sinY * sin_phi) / cosY;

            const dlon = BasicGeodesy.toDegrees(Math.atan2(sin_dlon, cos_dlon));

            return new Coordinate(coordinateP1.x + dlon, BasicGeodesy.toDegrees(phi_rad), z);
        }
    }

    // Calculate a distance in meters between 2 points.
    static TwoPointsGreatCircleDistance(aP1, aP2) {
        const lon1 = aP1.x;
        const lat1 = aP1.y;
        const lon2 = aP2.x;
        const lat2 = aP2.y;
        const dlonrad2 = BasicGeodesy.toRadians(lon2 - lon1) / 2.0;
        const dlatrad2 = BasicGeodesy.toRadians(lat2 - lat1) / 2.0;

        const sin_dlon = Math.sin(dlonrad2);
        const sin_dlat = Math.sin(dlatrad2);

        const sind_d2 = Math.sqrt(sin_dlat * sin_dlat + Math.cos(BasicGeodesy.toRadians(lat1)) * Math.cos(BasicGeodesy.toRadians(lat2)) * sin_dlon * sin_dlon);
        return 2.0 * Math.asin(sind_d2) * ARC_DEGREE_TO_METER;
    }
}

class Coordinate {
    constructor(x, y, z) {
        if (x instanceof Array ) {
            const arr = x;
            this._x =  arr[0];
            this._y =  arr[1];
            this._z =  arr[2];
        } else {
            this._x = x;
            this._y = y;
            this._z = z;
        }
    }

    setFromArray(arr) {
        if (arr instanceof Array ) {
            this._x =  arr[0];
            this._y =  arr[1];
            this._z =  arr[2];
        }
    }

    getAsArray() {
        const arr = [this._x, this._y];
        if (typeof this._z != "undefined") {
            arr.push(this._z);
        }
        return arr;
    }

    get x() {
        return this._x;
    }

    set x(value) {
        this._x = value;
    }

    get y() {
        return this._y;
    }

    set y(value) {
        this._y = value;
    }

    get z() {
        return this._z;
    }

    set z(value) {
        this._z = value;
    }
}

module.exports = {
    BasicGeodesy: BasicGeodesy,
    Coordinate: Coordinate
};
