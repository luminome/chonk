import {dragControls} from './drags.js';
import {keyControls} from './keys.js';
import * as THREE from 'three/build/three.module.js';///build/three.module.js'; ONLY ONCE
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import {mergeBufferGeometries, mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {data_loader as fetchAll} from './data-loader.js';

import * as UTIL from './utilities.js';
import * as MATS from './materials.js';
import * as classes from './classes.js';
import * as methods from './ui_methods.js';
import {vars} from './vars.js';
import {curve_original_point_test, get_sector_from_world_point} from "./utilities.js";
import {auxPointsMaterial3} from "./materials.js";

//#// LABELS READING:
//https://bocoup.com/blog/learning-three-js-with-real-world-challenges-that-have-already-been-solved
//#// Bezier solution
//http://phrogz.net/svg/closest-point-on-bezier.html
//https://stackoverflow.com/questions/2742610/closest-point-on-a-cubic-bezier-curve

"use strict";

function exportToJsonFile(jsonData, file_name) {
    let dataStr = JSON.stringify(jsonData);
    let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    let exportFileDefaultName = file_name+'_data.json';

    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

const heavy_data = new FontFace('heavy_data', 'url(./pf_tempesta_seven.ttf)');
heavy_data.load().then(function(font) {
	document.fonts.add(font);
});

let rand_label;

const nav_bar_offset = 24;
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("nav_svg");
const loader = document.getElementById("load_bar");
svg.setAttributeNS(null, 'width', window.innerWidth);
svg.setAttributeNS(null, 'height', nav_bar_offset);

function createRect(tag_id, color, width, opacity) {
	let rect = document.createElementNS(svgNS, 'rect');
	rect.setAttributeNS(null, 'id', tag_id);
	rect.setAttributeNS(null, 'x', (width / -2));
	rect.setAttributeNS(null, 'y', 0);
	rect.setAttributeNS(null, 'width', width);
	rect.setAttributeNS(null, 'height', nav_bar_offset);
	rect.setAttributeNS(null, 'fill', color);
	rect.setAttributeNS(null, 'opacity', opacity);
	rect.setAttributeNS(null, 'href', 'http://www.google.com');
	rect.setAttributeNS(svgNS, 'data-wid', width);
	svg.appendChild(rect);
}

function createText() {
	let newText = document.createElementNS(svgNS, "text");
	newText.setAttributeNS(null, 'id', 'nav_info');
	newText.setAttributeNS(null, "x", 8);
	newText.setAttributeNS(null, "y", nav_bar_offset - 8);
	newText.setAttributeNS(null, "fill", 'greenyellow');
	newText.setAttributeNS(null, "class", 'svg_text');
	// newText.setAttributeNS(null,"width","100%");
	newText.setAttributeNS(null, "height", "auto");
	newText.setAttributeNS(null, "font-size", "9");
	newText.appendChild(document.createTextNode('hello'));
	// add the text node to the SVG element
	svg.appendChild(newText);
}

let nav_bar_pos = 0.5;
let nav_origin = 0.5;
let nav_zero = 0.5;

function update_nav_position(U_pos) {
	let r_mark = svg.childNodes[0];
	let p = window.innerWidth * 0.5;//U_pos;
	nav_bar_pos = U_pos;
	r_mark.setAttributeNS(null, 'x', p - 2);//(p-3).toString());
}

createRect('svg_center', 'gray', 4, 1);
createRect('svg_origin', 'orange', 6, 1);
createRect('svg_zero', 'white', 2, 0.2);

const svg_center = svg.getElementById("svg_center");
const svg_origin = svg.getElementById("svg_origin");
const svg_zero = svg.getElementById("svg_zero");

let user_nav_position = 0;
let user_nav_guide_length = 0;
let user_slide_scale = 0;

const el_width = (e) => parseFloat(e.getAttributeNS(svgNS, 'data-wid')) / 2;

function create_landmark(position, scale, name, pid) {
	let circle = document.createElementNS(svgNS, 'circle');
	circle.setAttributeNS(null, 'cx', 10);
	circle.setAttributeNS(null, 'cy', nav_bar_offset / 2);
	circle.setAttributeNS(null, 'r', 2 + ((4 - scale) / 2) * 2);//(4/scale)*2);
	circle.setAttributeNS(null, 'style', 'fill: yellow; stroke: black; stroke-width: 0.5px;');
	circle.setAttributeNS(svgNS, 'data-name', name);
	circle.setAttributeNS(svgNS, 'data-id', pid);
	circle.setAttributeNS(svgNS, 'data-wid', 2 + ((4 - scale) / 2) * 4);
	circle.setAttributeNS(svgNS, 'data-pos-scalar', position);
	circle.setAttributeNS(svgNS, 'data-pos-offset', position);
	//console.log(name, position);
	return circle;
}

function nav_update_guide_places(guide_data_obj) {
	//console.log(vars.user.guide_position_scalar);
	let guide_id = guide_data_obj.userData.guide.shape;
	let nav_guide = svg.getElementById(guide_id + '-guide');
	if (!nav_guide) nav_build_guide_places(guide_id);
	nav_guide = svg.getElementById(guide_id + '-guide');

	let places = guide_data_obj.userData.guide.linked_places;
	let rip_stop = 0;
	let len = nav_guide.getAttributeNS(svgNS, 'data-indexed');
	if (len !== null) {
		if (len < places.length) {
			rip_stop = len;
		}
	}
	nav_guide.setAttributeNS(svgNS, 'data-indexed', places.length);
	let zp = user_nav_position - 0.5;
	zp = UTIL.naturalize_on_loop(zp, true);
	for (let i = rip_stop; i < places.length; i++) {
		const p = places[i];
		let position = p.position;
		let scale = p.place.scale;
		const circle = create_landmark(position, scale, p.place.name, i);
		let ps = zp - position;
		ps = UTIL.naturalize_on_loop(ps, true);
		circle.setAttributeNS(null, 'cx', (window.innerWidth * ps));
		circle.setAttributeNS(svgNS, 'data-pos-offset', ps);
		nav_guide.appendChild(circle);
	}
}

function nav_build_guide_places(guide_shape_id) {
	let group = document.createElementNS(svgNS, 'g');
	group.setAttributeNS(null, 'id', guide_shape_id + '-guide');
	group.setAttributeNS(null, 'class', 'guide_places');
	group.setAttributeNS(null, 'x', 0);
	group.setAttributeNS(null, 'y', 0);
	group.setAttributeNS(null, 'width', window.innerWidth);
	group.setAttributeNS(null, 'height', nav_bar_offset);
	group.style.display = 'none';
	svg.appendChild(group);
}

function set_guide_position_to_nav_bar(pos_scalar, overall_length) {
	const the_guide = get_guide(vars.user.selected_guide);
	//nav_update_guide_places(the_guide);
	let zp = pos_scalar - 0.5;
	zp = UTIL.naturalize_on_loop(zp, true);
	const boxArray = [...svg.getElementsByTagName('g')];
	for (let g of boxArray) g.style.display = "none";

	let guide_places = svg.getElementById(the_guide.userData.guide.shape + '-guide');
	if (guide_places) {

		guide_places.style.display = "block";


		for (let p of guide_places.childNodes) {
			let ps = zp - parseFloat(p.getAttributeNS(svgNS, 'data-pos-scalar')); //(pos_scalar-0.5)-
			ps = UTIL.naturalize_on_loop(ps, true);
			p.setAttributeNS(null, 'cx', (window.innerWidth * ps));//-(el_width(p)));
			p.setAttributeNS(svgNS, 'data-pos-offset', ps);
		}
	}
	user_nav_guide_length = overall_length * UTIL.km_deg;
	user_slide_scale = window.innerWidth / user_nav_guide_length;
	user_nav_position = pos_scalar;

	nav_origin = 0.5;
	nav_zero = zp;

	svg_zero.setAttributeNS(null, 'x', (window.innerWidth * nav_zero) - (el_width(svg_zero)));
	svg_origin.setAttributeNS(null, 'x', (window.innerWidth * nav_origin) - (el_width(svg_origin)));

}

update_nav_position(0.5);

const nav_info = svg.getElementById("nav_info");

function update_nav(offset_amount) {
	nav_zero += offset_amount;
	nav_origin += offset_amount;
	nav_zero = UTIL.naturalize_on_loop(nav_zero, true);
	nav_origin = UTIL.naturalize_on_loop(nav_origin, true);

	svg_origin.setAttributeNS(null, 'x', (window.innerWidth * nav_origin) - (el_width(svg_origin)));
	svg_zero.setAttributeNS(null, 'x', (window.innerWidth * nav_zero) - (el_width(svg_zero)));

	user_nav_position += offset_amount;
	user_nav_position = UTIL.naturalize_on_loop(user_nav_position, true);

	const guide_places = svg.getElementById(vars.user.selected_guide + '-guide');
	if (guide_places) {
		for (let p of guide_places.childNodes) {
			let ps = parseFloat(p.getAttributeNS(svgNS, 'data-pos-offset'));
			ps += offset_amount;
			ps = UTIL.naturalize_on_loop(ps, true);
			p.setAttributeNS(null, 'cx', (window.innerWidth * ps));//-(el_width(p)));
			p.setAttributeNS(svgNS, 'data-pos-offset', ps);
		}
	}

	//nav_info.childNodes[0].nodeValue = user_nav_guide_length.toFixed(2)+'km '+user_nav_position.toFixed(2)+' '+nav_selected_guide;
}

function svg_interact(type, deltaX, deltaY, object, event) {
	if (type === 'drag') {
		let ost = vars.view_flip ? 1 : -1;
		let offset = (deltaX / window.innerWidth) * (user_slide_scale) * ost;

		update_nav(offset);

		move_point_on_curve(user_nav_position, false);
		//scroll_phi_theta(nav_bar_pos,false);
		//console.log(type,deltaX);
	} else if (type === 'clicked') {
		let ost = vars.view_flip ? 1 : -1;
		let offset = ((deltaX / window.innerWidth) - 0.5) * (-1);

		update_nav(offset);

		move_point_on_curve(user_nav_position, false);

	} else if (type === 'move') {
		//console.log(event.target.tagName);
		if (event.target.tagName === 'circle') {
			const the_guide = get_guide(vars.user.selected_guide);
			let pid = event.target.getAttributeNS(svgNS, 'data-id');
			let p = the_guide.userData.guide.linked_places[pid];
			//log.place.echo(event.target.getAttributeNS(svgNS, 'data-id'));
			log.nav.echo([p.place.name, p.place.locale, '(' + p.place.country + ')']);
		}

	} else {
		if(log.nav) log.nav.unwatch();
	}
}

dragControls(svg, svg_interact, svg, {passive: true});//camera_position


const log_field = document.getElementById('info');
const log_field_right = document.getElementById('info_ui');

let log = {};
let log_new = false;

function log_display() {
	if (!log_new) return;
	log_field.innerHTML = '';
	for (const l in log) {
		let obj = log[l];
		if (obj.watch) {
			let lines_array = obj.val;
			log_field.innerHTML += '<b class="highlited">' + obj.name + '</b></br>';
			if (lines_array) {
				for (let li of lines_array) {
					log_field.innerHTML += (li === undefined ? 'undefined' : li) + '</br>';//.toString()
				}
			}
		}
	}
	log_new = false;
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
class log_var {
	constructor(name, initial = null) {
		this.name = name;
		this.val = initial;
		this.watch = null;
	}

	echo(val) {
		if (val !== this.val) log_new = true;
		this.val = val;
		this.watch = true;
	}

	unwatch() {
		this.watch = null;
	}
}


const ui_el = document.getElementById("layers_ui");


////`${name}`
const state_keys_magic = {
	move: function (o) {
		const flip = vars.view_flip ? o : o*-1;
		move_point_on_curve(flip, true);
	},
	guides: function (o) {
		map_guides.visible = o;
		map_guides_verts.visible = o;
	},
	general: function(state, name, v=null){
		map_tiles_group.children.filter(t => t.hasOwnProperty(name)).forEach(t => t[name].visible = state);
		data_sliders.filter(t => t.name === name).forEach(t => t.element.style.display = ['none','block'][+state]);
		//#console.log(name);
	},
	vars_bool: function(state, name, value){
		vars[name] = state;
	},
	vars_number: function(state, name, value){
		console.log(state, name, value);
		vars[name] = parseFloat(value);
	},
	sectors: function (o) {
		map_tiles_group.visible = o;
	},
	grid: function (o) {
		map_points.visible = o;
	},
	map_grid: function (o) {
		gridHelper.visible = o;
	},
	planes: function (o) {
		map_tiles_group.children.forEach(t => t.plane.visible = o);
	},
	fills: function (o) {
		map_tiles_group.children.forEach(t => t.fills.visible = o);
	},
	lines: function (o) {
		map_tiles_group.children.forEach(t => { if(t.hasOwnProperty('lines')) t.lines.visible = o; });
	},
	places: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('places')).forEach(t => { if(t.hasOwnProperty('places')) t.places.visible = o; })
	},
	urban: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('urban')).forEach(t => { if(t.hasOwnProperty('urban')) t.urban.visible = o; })
	},
	protected_regions: function (o) {
		map_tiles_group.children.forEach(t => { if(t.hasOwnProperty('protected_regions')) t.protected_regions.visible = o; })
	},
	depth_points: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('depth_points')).forEach(t => t.depth_points.visible = o);
	},
	contours: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('contours')).forEach(t => t.contours.visible = o);
	},
	sst: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('sst')).forEach(t => t.sst.visible = o);
	},
	wind: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('wind')).forEach(t => t.wind.visible = o);
	},
	wudi: function (o) {
		map_tiles_group.children.filter(t => t.hasOwnProperty('wudi')).forEach(t => t.wudi.visible = o);
	},
	abstract: function (o) {
		//console.log(cube.rotation);
		if (o) {
			cube.userData.last_rotation = cube.rotation.clone();
			cam_base_pos.set(0, 0, vars.view.base_pos);
			cube.rotation.set(Math.PI / -2, 0, 0);
		} else {
			if (cube.userData.hasOwnProperty('last_rotation')) {
				const fr = cube.userData.last_rotation;
				cube.rotation.set(fr._x, fr._y, fr._z);
			}
			cam_base_pos.set(0, 0, 10);
		}
	},
	view_flip: function (o) {
		vars.view_flip = o;
	},
	view_to_threshold: function (o) {
		vars.view_to_threshold = o;
	},

}

let menus = {};

let camera, scene, renderer, stats, cube, raycaster, user_position_marker, user_mouse_marker, nice_arrow, nice_arrow_mini, nice_arrow_spec;
let axis_helper, grid_helper, arrow_helper, arrow_helper_2, arrow_helper_3, markers_group, north_mark;
let map_tiles_group, map_group, map_plane, map_points, map_guides, map_data_guides, map_guides_verts;
let state_keys, gen_keys;
let data_sliders = [];
let gridHelper;
let load_counter = 0;
let load_scope = 0;


map_group = new THREE.Group();
map_tiles_group = new THREE.Group();


//handle camera
const cube_box = new THREE.BoxGeometry(2, 2, 2);
cube = new THREE.Mesh(cube_box, new THREE.MeshStandardMaterial({color: 0xffffff}));
cube.rotateX(Math.PI / -2);

let cam_base_pos = new THREE.Vector3(0, 0, vars.view.base_pos);
let cam_pos = new THREE.Vector3(0, vars.view.base_pos, 0);

const camera_frustum = new THREE.Frustum();
const camera_frustum_m = new THREE.Matrix4();

const w = new THREE.Vector3();
const k = new THREE.Vector3();
const v = new THREE.Vector3();
const u = new THREE.Vector3(0, 1, 0);
const un = new THREE.Vector3(0, 0, 1);
const v_q = new THREE.Quaternion();
const color = new THREE.Color();

axis_helper = new THREE.AxesHelper(10);
grid_helper = new THREE.GridHelper(vars.grid_size, vars.grid_divisions);

const dir = new THREE.Vector3(0, 0, 1);
const origin = new THREE.Vector3(0, 0, 0);
const length = 2;
let hex = 0xFFFF00;
arrow_helper = new THREE.ArrowHelper(dir, origin, length, hex);
arrow_helper.visible = true;
arrow_helper_2 = new THREE.ArrowHelper(dir, origin, length * 0.5, hex);
arrow_helper_2.visible = true;
arrow_helper_3 = new THREE.ArrowHelper(dir, origin, length * 0.5, hex);
arrow_helper_3.visible = true;


function show_load(i){
	load_scope = load_counter+i > load_counter ? load_counter+i : load_scope;
	load_counter += i;
	if(load_counter === 0) load_scope = 0;
	const ost = load_scope > 0 ? load_counter / load_scope : 0;
	const seg = Math.floor(window.innerWidth / load_scope);
	const arm = `repeating-linear-gradient(to right, greenyellow 0, greenyellow ${seg-2}px, transparent ${seg}px, transparent ${seg+2}px)`;
	loader.style.width = (ost*window.innerWidth)+'px'.toString();
	loader.style.background = arm;
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
const get_guide = (g_num) => map_guides.children.find(g => g.userData.guide.shape === g_num);
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// SCENE BUILDING:
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function map_guides_resolve_places(place_node, tile_number) {
	const clone = Object.assign({}, place_node);
	k.set(clone.loc[0], clone.loc[1], 0.0);

	let set = map_tiles_group.children[tile_number].intersects_shapes;
	let places_count = 0;
	for (let l of set) {
		const c_pos = get_point_on_curve(k, l);
		if (c_pos[0]) {
			const the_guide = get_guide(l);
			const p_obj = {
				'position': c_pos[0],
				'place': clone,
				'uid': places_count
			}
			places_count++;
			the_guide.userData.guide.linked_places.push(p_obj);
			nav_update_guide_places(the_guide);
		}
	}
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function make_user_position_mark(radius) {
	const curve = new THREE.EllipseCurve(
		0, 0,            // ax, aY
		radius, radius,           // xRadius, yRadius
		0, 2 * Math.PI,  // aStartAngle, aEndAngle
		true,            // aClockwise
		0                 // aRotation
	);

	curve.updateArcLengths();

	const points = curve.getPoints(201);
	const geometry = new THREE.BufferGeometry().setFromPoints(points);

	const material = new THREE.LineDashedMaterial({
		color: 0x00FF00,
		linewidth: 1,
		scale: 1,
		dashSize: 0.1,
		gapSize: 0.1,
	});

	// Create the final object to add to the scene
	const line = new THREE.Line(geometry, material);
	line.userData.radius = radius;
	line.computeLineDistances();
	line.rotateX(Math.PI / 2);
	return line;

}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function make_pointer_arrow() {
	let points = [];
	const raw_points = [
		0, 0,
		10, 20,
		6, 20,
		7, 32,
		0, 32
	];

	for (let e = 0; e < raw_points.length; e += 2) {
		points.push(new THREE.Vector2(raw_points[e], raw_points[e + 1]));
	}

	const a_geometry = new THREE.LatheGeometry(points, 20);
	const a_material = new THREE.MeshStandardMaterial({
		color: 0xFF3300,
		side: THREE.FrontSide,
		flatShading: true,
		roughness: 0,
		metalness: 0.25,
		emissive: 0x161616
	});
	//const a_material = new MeshStandardMaterial( { color: 0xffff00 } );
	const arrow = new THREE.Mesh(a_geometry, a_material);
	arrow.userData.base_color = arrow.material.color;
	arrow.material.needsUpdate = true;

	arrow.scale.set(0.02, 0.02, 0.02);
	return arrow;

}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function make_markers_group() {
	markers_group = new THREE.Group();
	const markes_count = 10;
	for (let n = 0; n < markes_count; n++) {
		const verts = new Float32Array(18);
		let int = (Math.PI * 2) / 6;
		for (let i = 0; i < verts.length; i += 3) {
			verts[i] = Math.cos((i / 3) * int);
			verts[i + 1] = Math.sin((i / 3) * int);
			verts[i + 2] = 0.0;
		}
		const a_geometry = new THREE.BufferGeometry();
		a_geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
		a_geometry.setIndex([0, 1, 2, 2, 3, 0, 3, 4, 5, 5, 0, 3]);
		const hexagon = new THREE.Mesh(a_geometry, MATS.mapMarkersMaterial);
		hexagon.rotateX(Math.PI / -2);
		hexagon.scale.set(0.050, 0.050, 0.050);
		markers_group.add(hexagon);
	}
	return markers_group;
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||











function key_do_something(key) {
	//console.log(key);
	let e = Object.keys(key);

	if(menus.hasOwnProperty(e)){
		menus[e].object.toggle_state();
	}else{
		state_keys_magic[e](key[e]);
	}
	log.state_keys.echo([e,key[e]]);
}

state_keys = {};

gen_keys = {
	'a': {'move': -1},
	'ArrowLeft': {'move': -1},
	'd': {'move': 1},
	'ArrowRight': {'move': 1},
}

function move(dir) {
	console.log('moved', dir);
}




//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function loadSVG_sub(url) {
	const loader = new SVGLoader();

	loader.load(url, function (data) {
		const paths = data.paths;
		let geoms = [];
		let fillColor = '0x00FF00';
		let opacity = 0.5;

		for (let i = 0; i < paths.length; i++) {
			const path = paths[i];
			fillColor = path.userData.style.fill;
			opacity = (path.userData.style.opacity !== undefined) ? path.userData.style.opacity : 1;
			const path_shape = path.toShapes(true);
			const mesh_geometry = new THREE.ShapeGeometry(path_shape);
			geoms.push(mesh_geometry);
		}

		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color().setStyle(fillColor),
			opacity: opacity,
			transparent: true,
			side: THREE.DoubleSide,
		});

		const g = mergeBufferGeometries(geoms);
		g.computeBoundingSphere();
		g.center();
		g.rotateX(Math.PI / 2);
		let map_mesh = new THREE.Mesh(g, material);
		north_mark.add(map_mesh);
		north_mark.scale.set(0.01, 0.01, 0.01);
		north_mark.position.setY(0.025);
	});
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function init() {
	const log_vars = [
		'pos',
		'zoom',
		'touching',
		'keys',
		'state_keys',
		'json',
		'info',
		'tile',
		'guide',
		'data_guide',
		'place',
		'click',
		'nav',
		'selection',
		'region',
		'special',
		'sector'
	];

	for (let e of log_vars) {
		log[e] = (new log_var(e))
	}
	vars.user.zoom = vars.view.base_pos;

	//log.info.echo(['init map_points count: ' + map_points.geometry.attributes.position.count]);

	//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
	function translateAction(type, deltaX, deltaY, object) {
		if (type === 'drag') {
			//#v.copy(vars.user.position);
			object.rotateOnWorldAxis(u, deltaX / 100);
			object.rotateX(deltaY / 100);
			// object.position.x += (-deltaX / (200/cam_base_pos.z));
			// object.position.y += (deltaY / (200/cam_base_pos.z));
			object.updateMatrixWorld();
		}

		if (type === 'zoom') {
			cam_base_pos.multiplyScalar(1 + (deltaY / 200));
			let zz = cam_base_pos.z.toFixed(2);
			vars.user.zoom = cam_base_pos.z;
			vars.user.zoom_level = vars.view.get_zoom(vars.user.zoom / vars.view.base_pos);
			log.zoom.echo([zz, 'level-' + vars.user.zoom_level]);

		} else {
			log.zoom.unwatch();
		}

		if (type === 'clicked') vars.user.mouse.clicked = true;

		vars.user.mouse.state = type;
		vars.user.mouse.x = (deltaX / vars.view.width) * 2 - 1;
		vars.user.mouse.y = (-deltaY / vars.view.height) * 2 + 1;

	}

	//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
	function getKeyActions(raw) {

		Object.keys(state_keys).forEach(key => state_keys[key].set(raw.includes(key)))
		//console.log(raw);

		let pk = Object.keys(gen_keys);
		let dpk = pk.filter(a => raw.includes(a));

		if (dpk.length > 0) {
			dpk.forEach(key => key_do_something(gen_keys[key]));
			log.keys.echo(dpk);
		} else {
			log.keys.unwatch();
		}

	}

	//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
	camera = new THREE.PerspectiveCamera(50, vars.view.width / vars.view.height, 1, 1000);
	scene = new THREE.Scene();
	scene.background = new THREE.Color(vars.env_color);

	user_position_marker = make_user_position_mark(1);
	user_mouse_marker = make_user_position_mark(1);

	nice_arrow = make_pointer_arrow();
	nice_arrow_mini = make_pointer_arrow();
	nice_arrow_mini.scale.set(0.01, 0.01, 0.01);
	nice_arrow_mini.material.color.offsetHSL(0, 0, 1.0);

	nice_arrow_spec = make_pointer_arrow();
	nice_arrow_spec.scale.set(0.01, 0.05, 0.01);
	nice_arrow_spec.material.color.offsetHSL(0.5, 1.0, 0.5);
	nice_arrow_spec.rotateX(Math.PI / -2);


	north_mark = new THREE.Object3D();
	loadSVG_sub('./img/north.svg');
	scene.add(north_mark);

	const triangle = make_markers_group();

	nice_arrow_spec.visible = true;
	map_group.add(nice_arrow_spec);

	scene.add(map_group);

	scene.add(arrow_helper);
	scene.add(triangle);
	scene.add(arrow_helper_2);
	scene.add(arrow_helper_3);
	scene.add(user_position_marker);
	scene.add(user_mouse_marker);
	scene.add(nice_arrow);
	scene.add(nice_arrow_mini);

	user_position_marker.position.copy(vars.user.position);

	const light = new THREE.PointLight(0xFFFFFF, 2); ///0xDB8B00
	light.position.set(0, 1000);
	scene.add(light);

	//scene.fog = new THREE.Fog( vars.env_color, 0.015, 50 );

	renderer = new THREE.WebGLRenderer();//{powerPreference: "high-performance", antialias: true});
	renderer.setPixelRatio(1);//window.devicePixelRatio);//(2)
	renderer.setSize(vars.view.width, vars.view.height);
	document.body.appendChild(renderer.domElement);

	dragControls(renderer.domElement, translateAction, cube, {passive: true});//camera_position
	keyControls(window, getKeyActions);

	stats = new Stats();
	// document.body.appendChild(stats.dom);

	raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.05;//025;
	raycaster.params.Points.threshold = 0.1;//


	window.addEventListener('resize', onWindowResize);


	const shape = vars.map.data.map_spec.shape;
	const degre = vars.map.data.map_spec.map_degrees;
	const size = vars.map.s * Math.max(shape.w, shape.h);
	const divisions = (1/degre) * Math.max(shape.w, shape.h);



	vars.view.base_pos = (vars.map.s) * shape.h; //Math.max(shape.w, shape.h);
	cam_base_pos.setZ(vars.view.base_pos);
	cam_pos.setY(vars.view.base_pos);

// 		let cam_base_pos = new THREE.Vector3(0, 0, vars.view.base_pos);
// let cam_pos = new THREE.Vector3(0, vars.view.base_pos, 0);

	const col_xy = new THREE.Color("hsl(306, 100%, 30%)");
	const col_gd = new THREE.Color("hsl(306, 100%, 20%)");

	gridHelper = new THREE.GridHelper( size, divisions, col_xy, col_gd );
	scene.add( gridHelper );

	rand_label = new classes.generic_label(20,20);
	rand_label.set_text(["∆ so kext anything goes here.","∆ 01234567","∆ AND again more texts"]);
	rand_label.position.set(size/2,0,0);
	scene.add(rand_label);

	scene.updateMatrixWorld();
	//make_menus();

}




//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function move_point_on_curve(dir, key_action = true) {
	if (vars.user.selected_guide === null) return;
	const guide = get_guide(vars.user.selected_guide);
	const guide_curve = guide.userData.guide.curve;
	const centroid = guide.userData.guide.centroid.clone();
	const L = 1 / UTIL.deg_to_km(guide_curve.getLength());
	const D = vars.traversal_rate * L;

	if (key_action) {
		vars.user.guide_position_scalar += D * dir;
		update_nav(D * dir);
		vars.user.guide_position_scalar = UTIL.naturalize_on_loop(vars.user.guide_position_scalar);
	} else {
		vars.user.guide_position_scalar = dir;
	}

	const guide_position_scalar = vars.user.guide_position_scalar;
	const thresh = vars.threshold_size;


	let a = UTIL.naturalize_on_loop(guide_position_scalar - (thresh * D), true);
	let b = UTIL.naturalize_on_loop(guide_position_scalar + (thresh * D), true);

	let ua = guide_curve.getUtoTmapping(a);
	let ub = guide_curve.getUtoTmapping(b);
	let ac = guide_curve.getPoint(ua);
	let bc = guide_curve.getPoint(ub);
	map_group.localToWorld(ac);
	map_group.localToWorld(bc);

	let um = guide_curve.getUtoTmapping(guide_position_scalar);
	let c = guide_curve.getPoint(um);
	// let fc = c.clone();
	map_group.localToWorld(c);

	markers_group.children[0].position.copy(ac);
	markers_group.children[1].position.copy(bc);

	map_group.localToWorld(centroid);

	k.subVectors(ac, bc).multiplyScalar(0.5).add(bc);
	vars.user.position.copy(k);
	arrow_helper.position.copy(k);
	//position_user(k, 'move');

	cube.getWorldDirection(v);

	let view_dir = vars.view_flip ? 1 : -1;

	if (vars.view_to_threshold) {
		w.subVectors(ac, bc).normalize();
		k.crossVectors(u, w).multiplyScalar(view_dir).normalize();
		arrow_helper.setDirection(k);
	} else {
		k.subVectors(centroid, vars.user.position.clone()).multiplyScalar(view_dir).normalize();
		arrow_helper.setDirection(k);
	}

	nice_arrow_mini.position.copy(vars.user.position);
	north_mark.position.copy(un.clone().multiplyScalar(user_position_marker.userData.radius * -2).add(vars.user.position));

	//map_group.worldToLocal(vars.user.local_position);

	//log_field_right.innerHTML += '</br>'+vars.user.local_position.x;

	w.crossVectors(u, v);
	let angle = w.dot(k);
	cube.rotateOnWorldAxis(u, angle);
	cube.updateMatrixWorld();

	vars.user.sector = UTIL.get_sector_from_world_point(vars.map, vars.user.position);

	v.copy(vars.user.position);
	//v.setY(10.0);
	k.set(0,0,1).normalize();
	//arrow_helper.setDirection(k);

	raycaster.set(v, k);
	const intersects = raycaster.intersectObject(map_points);//map_tiles_group.children[vars.user.sector]);//map_group);//map_tiles_group.children);
	const tst = intersects.map(e => e.object).filter(e => e.userData.hasOwnProperty('scans') && e.userData.scans);

	log_field_right.innerHTML = k.toArray() + '</br>';//intersects.length+'</br>';
	tst.forEach(t => log_field_right.innerHTML += Object.keys(t.userData)+t.id+'</br>');


		//log_field_right.innerHTML += intersects.length+'</br>';
	//.set ( origin : Vector3, direction : Vector3 )


}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function onWindowResize() {
	vars.view.reset();
	camera.aspect = vars.view.width / vars.view.height;
	camera.updateProjectionMatrix();
	renderer.setSize(vars.view.width, vars.view.height);
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function position_user(target_pos, mode = 'none') {
	if (mode === 'clicked') {
		if (vars.user.touching_guide === null) {
			vars.user.selected_guide = null;
			const boxArray = [...svg.getElementsByTagName('g')];
			for (let g of boxArray) g.style.display = "none";
		} else {
			vars.user.selected_guide = vars.user.touching_guide;
			const guide = get_guide(vars.user.selected_guide);


			UTIL.curve_tangent_point_test(null, guide, map_group, map_points, map_tiles_group, vars.curve_segments);
			//const re_position = UTIL.curve_original_point_test(null, guide, map_group, map_points, map_tiles_group, vars.curve_segments);

			//#const re_position = UTIL.curve_original_point_test(null, guide, map_group, map_points, map_tiles_group);

			k.copy(vars.user.pointer_position);
			map_group.worldToLocal(k);
			let c_pos = UTIL.get_point_on_guide(k, guide, vars.curve_segments);//vars.user.selected_guide);
			map_group.localToWorld(c_pos[1]);

			vars.user.guide_position_scalar = c_pos[0];

			set_guide_position_to_nav_bar(vars.user.guide_position_scalar, guide.userData.guide.length);
			move_point_on_curve(0, true);
		}



		v.copy(vars.user.pointer_position);
		vars.user.sector = get_sector_from_world_point(vars.map, v);
		vars.user.position.copy(v);

		log.sector.echo([vars.user.sector]);

		k.set(0, 0.05, 0);
		v.add(k);

		arrow_helper.position.copy(v);
		arrow_helper_2.position.copy(v);
		arrow_helper_3.position.copy(v);

		camera.getWorldDirection(k);
		w.crossVectors(k, u);
		k.projectOnPlane(u);

		arrow_helper.setDirection(u);
		arrow_helper_2.setDirection(w);
		arrow_helper_3.setDirection(k);
		north_mark.position.copy(un.clone().multiplyScalar(user_position_marker.userData.radius * -1.2).add(v));
		nice_arrow.position.copy(v);
		user_position_marker.position.copy(v);
	}
	if (mode === 'move') {
		user_mouse_marker.visible = true;
		user_mouse_marker.position.copy(target_pos);
	}
	if (mode === 'none') {
		user_mouse_marker.visible = false;
	}
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function animate() {
	requestAnimationFrame(animate);
	render();
	stats.update();
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
let vn = 0, vm = 0;
let ctr = {v:0,p:0,n:0,t:0,t2:0,i:1,j:0,s:0,f:0};

function pulse(a){
	ctr.t = a-ctr.t;
	if(ctr.f === ctr.p){
		ctr.t2 = a-ctr.t2;
		ctr.p = (ctr.f+vars.update_frequency);
		if(!vars.update_pause) frame();
		ctr.t2 = a;
	}else{
		ctr.f++;
	}
	ctr.t = a;
}

function frame(){
	//log.special.echo([vars.auxillary]);
	ctr.v++;

	//rand_label = new classes.generic_label(20,20);
	const stex = Object.entries(ctr);
	rand_label.set_text(stex);

	for(let s of data_sliders){
		s.register_frame(1);//ctr.v);
	}

	//map_tiles_group.children.forEach(t => t.update_frame('sst',ctr.v));



	//if(ctr.v % dat.POINT_IDLE === 0) subvert(points.geometry);
	//console.log(ctr.v, "frame");
	//sign.material.map.needsUpdate = true

}


let selected_protected_regions = [];

function render(a) {
	pulse(a);

	v_q.setFromUnitVectors(u, vars.user.position.clone().normalize());
	cam_pos.lerp(cam_base_pos.clone().applyQuaternion(cube.quaternion), 0.1);
	camera.up.lerp(u.clone().applyQuaternion(cube.quaternion), 0.1);
	camera.position.addVectors(cam_pos, vars.user.position);
	camera.lookAt(vars.user.position);
	raycaster.setFromCamera(vars.user.mouse, camera);
	camera.updateMatrix();
	camera.updateMatrixWorld();

	camera_frustum.setFromProjectionMatrix(camera_frustum_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	//tile.display = camera_frustum.containsPoint(k);

	vars.user.local_position.subVectors(camera.position, vars.user.position).multiplyScalar(1).add(vars.user.position);
	map_group.worldToLocal(vars.user.local_position);

	let intersects = raycaster.intersectObject(map_plane);
	if (intersects.length > 0) {
		v.copy(intersects[0].point);
		vars.user.pointer_position.copy(v);
		map_group.worldToLocal(v);
		log.pos.echo(['LON ' + v.x.toFixed(4), 'LAT ' + v.y.toFixed(4), vars.user.mouse.state]);
	}


	intersects = raycaster.intersectObjects(map_data_guides.children);
	if(intersects.length > 0){
		const pref = intersects.filter(i => i.object.type === 'Line').sort(function(a,b){return a.distance-b.distance;});
		if(pref.length){
			const pro = pref[0].index-Math.round((pref[0].index-pref.at(-1).index)/2);
			//log.data_guide.echo([JSON.stringify(intersects[0])]);
			//const pcts = intersects[0].object.points.length;
			log.data_guide.echo([pref.length, pref[0].index+'-'+pref.at(-1).index+':'+pro, ...Object.entries(pref[0].object.userData)]);
			const offset = pro / (pref[0].object.userData.points_count-1);
			const rpt = pref[0].object.userData.curve.getPointAt(offset);
			nice_arrow_spec.position.copy(rpt);
			//log.data_guide.echo([intersects[0].index, JSON.stringify(intersects[0].object.userData)]);
		}
	}else{
		log.data_guide.unwatch();
	}

	document.body.style.cursor = 'default';
	vars.user.touching_guide = null;

	selected_protected_regions = [];

	for (let tile of map_tiles_group.children) {
		v.subVectors(vars.user.local_position, tile.center);
		vm = vars.view.get_zoom((v.length() * vars.map.s) / vars.view.base_pos)*1.0; //1.0 bc zoom returns a string
		if (tile.zoom_level !== vm) {
			tile.zoom_level = vm;
			tile.plane.material.opacity = tile.zoom_level / 5;
			if (tile.zoom_level >= 1) tile.update(tile.zoom_level);
			const c = Object.keys(tile.data_keys).filter((k) => tile.data_keys[k].hasOwnProperty('spc') === true);
			tile.update_data(c);
		}
		//this is ticks for the entire group of tiles so the output ovwrrwrites


		if (tile.zoom_level > 2 && vars.user.mouse.state !== 'drag') {
			intersects = raycaster.intersectObject(tile.plane);
			if (intersects.length) {
				if(tile.hasOwnProperty('protected_regions')){
					let g_pl = raycaster.intersectObject(tile.protected_regions);
					if(g_pl.length){
						g_pl.forEach(p => selected_protected_regions.push(p.object.userData.area.NAME));
					}
				}
				if(tile.hasOwnProperty('places')){
					let g_pl = raycaster.intersectObject(tile.places);
					if(g_pl.length){
						g_pl.forEach(p => log.place.echo(p.object.userData.place.name_short()));
					}else{
						log.place.unwatch();
					}
				}
				if(tile.hasOwnProperty('lines')){
					if(vars.map.data.map_spec.includes.includes('guides')) {
						let g = raycaster.intersectObject(tile.lines).filter(e => e.object.visible);
						if (g.length) {
							let sel = g[0].object.userData.line_shape;
							if (map_guides.userData.shapes.includes(sel) && vars.user.selected_guide !== sel) {
								position_user(g[0].pointOnLine, 'move');
								vars.user.touching_guide = sel;
								document.body.style.cursor = 'pointer';
							}
						}else{
							position_user(null);
						}
					}
				}
			}
		}
	}

	if(selected_protected_regions.length){
		selected_protected_regions.sort();
		log.region.echo(selected_protected_regions);
	}else {
		log.region.unwatch();
	}

	log.guide.echo([vars.user.touching_guide, vars.user.selected_guide]);

	if(vars.user.mouse.clicked){
		log.click.echo(['consumed('+vars.clicks+') clicks']);
		vars.clicks ++;
		vars.user.mouse.clicked = false;
		position_user(null,'clicked');
	}

	if(vars.map.time_data.hasOwnProperty('wind')){
		log.special.echo(['wind', vars.map.time_data.wind.frame]);
	}else{
		log.special.unwatch();
	}

	let az = (vars.user.zoom / vars.view.base_pos)*0.04;
	north_mark.scale.set(az,az,az);
	nice_arrow.scale.set(az,az,az);
	nice_arrow_mini.scale.set(az,az,az);


	//vars.user.ground_position.copy(vars.user.position);

	//map_group.worldToLocal(vars.user.ground_position);
	//nice_arrow_spec.position.copy(vars.user.ground_position);



	log_display();
	renderer.render(scene, camera);
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function start() {
	init();
	animate();
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function slider_update_callback(datum){
	map_tiles_group.children.forEach(t => {
		t.update_frame(datum[0], datum[1]);
	});
}




function get_wudi_curve(){
	//https://www.r-bloggers.com/2021/10/multiple-linear-regression-made-simple/
	let available_points = []
	const validated = map_tiles_group.children
	.filter(c => c.hasOwnProperty('wudi'))
	.map(c => available_points.push(...c.wudi.children.filter(c => c.type === "Mesh")))
	available_points.sort(function(a,b){return a.userData.data_point.data.i-b.userData.data_point.data.i;});
	// console.log(available_points);
	//
	// const points = available_points.map(c => new THREE.Vector3(c.userData.data_point.data.m[0],c.userData.data_point.data.m[1], 0.0));
	// //const points2 = available_points.map(c => [c.userData.data_point.data.i, ...c.userData.data_point.data.m]);
	// const points2 = available_points.map(c => c.userData.data_point.data.i);

	let pt_index = available_points[0].userData.data_point.data.i;
	let group_index = 0;
	let groups = [[]];
	for(let pct of available_points){

		const l_i = pct.userData.data_point.data.i;
		pct.userData.data_guide = group_index;

		//console.log(l_i);
		if(l_i !== pt_index){
			group_index++;
			groups[group_index] = [];
			pt_index = l_i;
			console.log("NEW",l_i);
		}
		groups[group_index].push(pct);
		pt_index++
	}


	console.log(groups);
	let guide_count = 0;

	function get_handles(pt, tension){
		const a = new THREE.Vector3(pt.userData.data_point.data.a[0],pt.userData.data_point.data.a[1], 0.0);
		const b = new THREE.Vector3(pt.userData.data_point.data.b[0],pt.userData.data_point.data.b[1], 0.0);
		const m = new THREE.Vector3(pt.userData.data_point.data.m[0],pt.userData.data_point.data.m[1], 0.0);

		k.subVectors(b,a);
		w.subVectors(m,a);
		w.projectOnVector(k).add(a);

		const ha = k.subVectors(a,w).multiplyScalar(tension).add(m).clone();
		const hb = k.subVectors(b,w).multiplyScalar(tension).add(m).clone();

		return {'m':m, 'a':ha, 'b':hb};

	}

	for(let points_collection of groups) {
		const points = points_collection.map(c => new THREE.Vector3(c.userData.data_point.data.m[0],c.userData.data_point.data.m[1], 0.0));
		let d_gradient = 0.0;
		let r_gradient = [];
		let tangents = [];

		const meta_curve = new THREE.CurvePath();
		// const root = new THREE.Vector3(pt.userData.data_point.data.m[0],pt.userData.data_point.data.m[1], 0.0);
		v.copy(points[0]);

		let point_index = 0;
		for(let pt of points_collection){

			const pts = get_handles(pt, 0.5);
			tangents.push(pts.b);
			//tangents.push(pts.b);

			if(point_index < points_collection.length-1){
				//get second point
				const pt2 = points_collection[point_index+1];
				const pts2 = get_handles(pt2, 0.5);
				tangents.push(pts2.a);

				const curve = new THREE.CubicBezierCurve3(pts.m, pts.b, pts2.a, pts2.m);
				//bezier_curves.push(curve);

				meta_curve.add(curve);
				//const grove = [pts.m, pts.b, pts2.a, pts2.m];

			}


			// k.subVectors(b,a);
			// w.subVectors(m,a);
			// w.projectOnVector(k);
			//
			// tangents.push(w.clone().add(a));
			//#//if you built a cubic-bezier @ each interval, you could know the length and add it to r_gradient.
			//#// then use https://threejs.org/docs/?q=curve#api/en/extras/core/CurvePath
			//#// to tie all the curves together.

			//this is biggest concern; no matter what the curves are doing.
			//has to be a hybrid projection of thispoint b and nextpoint a
			const ost_l = w.subVectors(pts.m,v).length();//distance from m to previous point
			//const ost_k = w.subVectors(m,b).length();
			//
			// const b_grad = d_gradient-((ost_k/ost_l)*ost_l);

			r_gradient.push([d_gradient, 0.0]);

			d_gradient += ost_l;

			v.copy(pts.m);
			//
			// if(point_index>0){
			// 	const pa = points_collection[point_index-1];
			//
			// 	const pnext = points_collection[point_index+1];
			// 	const pnext_t = points_collection[point_index+2];
			//
			//
			// }







			point_index += 1;
		}

		/*
		const fine_curve_test = new THREE.CatmullRomCurve3(points, true);
		fine_curve_test.curveType = "catmullrom";
		fine_curve_test.tension = 0.0;
		fine_curve_test.closed = false;
		fine_curve_test.arcLengthDivisions = points.length * vars.curve_segments;
		fine_curve_test.updateArcLengths();

		const fine_curve = new THREE.CatmullRomCurve3(points, true);
		fine_curve.curveType = "catmullrom";
		fine_curve.tension = 0.0;
		fine_curve.closed = false;
		fine_curve.arcLengthDivisions = points.length * vars.curve_segments;
		//fine_curve.updateArcLengths();

		console.log("CUREVE", fine_curve.getLength());
		console.log("CUREVE", fine_curve_test.getLength());

		//const FTO = (fine_curve.getLength() / fine_curve_test.getLength()) ;
		const FTO = fine_curve_test.getLength() / fine_curve.getLength();
		console.log(FTO);

		console.log("getLengths", fine_curve.getLengths(points.length));


		const fine_curve_len = fine_curve.getLength();
		const pref = r_gradient.slice(1, r_gradient.length);
		pref.push([fine_curve_len,0]);
		console.log(pref);

		const curvePoints = fine_curve.getSpacedPoints(points.length * vars.curve_segments);
		const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
		const curveObject = new THREE.Line(geometry, MATS.mapGuidesMaterial);
		curveObject.userData.guide_id = guide_count;
		curveObject.userData.points_count = curvePoints.length;
		curveObject.userData.curve = fine_curve;

		map_data_guides.add(curveObject);


		let pointsGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
		map_guides_verts = new THREE.Points(pointsGeometry, MATS.mapGuideVerticesMaterial);

		// const recalc = pref.map(r => {
		// 	let um = fine_curve.getUtoTmapping(r[0]/fine_curve_len);
		// 	return fine_curve.getPoint(um*FTO);
		// 	//return fine_curve.getPointAt(r[0]/fine_curve_len)
		// });
		const recalc = pref.map(r => {
			let cx = ((r[0]*(1/FTO))/(fine_curve_len));
			if(cx<=1 && cx>=0){
				let um = fine_curve.getUtoTmapping(cx);
				return fine_curve.getPoint(um);
			}else{
				return fine_curve.getPoint(0);
			}

		});
		console.log(recalc);

		pointsGeometry = new THREE.BufferGeometry().setFromPoints(recalc);
		const map_guides_verts2 = new THREE.Points(pointsGeometry, MATS.auxPointsMaterial3);
		//
		// const recalc2 = pref.map(r => {
		// 	if(r[1]/fine_curve_len < 1 && r[1]/fine_curve_len >= 0){
		// 		return fine_curve.getPointAt(r[1]/fine_curve_len);
		// 	}else{
		// 		return fine_curve.getPointAt(r[0]/fine_curve_len);
		// 	}
		// });
		//
		// console.log(recalc2);
		// //
		// // const recalc2 = pref.map(r => fine_curve.getPointAt(r[1]/fine_curve_len));
		// // console.log(recalc2);
		// //
		// pointsGeometry = new THREE.BufferGeometry().setFromPoints(tangents);
		// const map_guides_verts3 = new THREE.Points(pointsGeometry, MATS.auxPointsMaterial2);
		// map_data_guides.add(map_guides_verts3);

		//exportToJsonFile(points2, 'wudi');
		map_data_guides.add(map_guides_verts);
		map_data_guides.add(map_guides_verts2);
		//
		//
		*/
		let ref_points = [];
		let meta_length = meta_curve.getLength();
		console.log("meta_curveObject", meta_length );

		for(let L of meta_curve.getCurveLengths()){
			meta_curve.getPoint(L/meta_length,k);
			ref_points.push(k.clone());
		}

		const pointsGeometry = new THREE.BufferGeometry().setFromPoints(ref_points);
		const map_guides_verts2 = new THREE.Points(pointsGeometry, MATS.auxPointsMaterial);
		map_data_guides.add(map_guides_verts2);




		const meta_points = meta_curve.getPoints( 5 );
		const meta_geometry = new THREE.BufferGeometry().setFromPoints( meta_points );
		const material = new THREE.LineBasicMaterial( { color: 0xff0000 } );
		const meta_curveObject = new THREE.Line( meta_geometry, material );
		map_data_guides.add(meta_curveObject);


		// for(let cv of bezier_curves){
		// 	const points = cv.getPoints( 50 );
		// 	const geometry = new THREE.BufferGeometry().setFromPoints( points );
		// 	const material = new THREE.LineBasicMaterial( { color: 0xff0000 } );
		// 	const curveObject = new THREE.Line( geometry, material );
		// 	map_data_guides.add(curveObject);
		// 	// Create the final object to add to the scene
		//
		// }


		guide_count++;
	}

	//alert(map_data_guides.children.length);


}



vars.sector_load_callback = function(sector){
	//console.log(vars.map.sectors, sector);

	let pct = 0;
	map_tiles_group.children
	.filter(c => c.hasOwnProperty('wudi'))
	.map(c => pct += +(c.data_keys['wudi']['lv'][0] !== 2));

	if(pct === 0 && !vars.hasOwnProperty('wudi_loaded')){
		//#//	well that's curious...
		console.log('wudi done loading');
		vars.wudi_loaded = true;
		get_wudi_curve();
	}
	//console.log(pct);
	//c.data_keys['wudi']['lv'][0] === 2
}

function build_map_group(map_data_group, time_specific_data=null) {
	vars.map.time_data = {};
	//vars.sector_load_callback = sector_load_callback;

	for(let t of time_specific_data){
		vars.map.time_data[t] = {
			'data':map_data_group[t+'_indices'],
			'frame':0,
			'callback':slider_update_callback,
			'playing':false
		};
		const contain = document.getElementById("controls_area");
		const c = new methods.slider(t, contain, vars.map.time_data[t]);
		data_sliders.push(c);
	}

	for(let s of data_sliders){
		s.register_ready();
	}

	console.log("vars time_data", vars.map.time_data);
	console.log("map_spec", map_data_group.map_spec);

	vars.base_url = './data/'+map_data_group.map_spec.name+'/';

	const map_deg = map_data_group.map_spec.map_degrees;
	vars.map.map_deg = map_deg;
	vars.map.rect = map_data_group.map_spec.rect;
	vars.map.w = (vars.map.rect.max_X-vars.map.rect.min_X);//*(1/map_deg);
	vars.map.h = (vars.map.rect.max_Y-vars.map.rect.min_Y);//*(1/map_deg);

	vars.map.sectors = (vars.map.w * (1/map_deg))*( vars.map.h * (1/map_deg));
	vars.map.w_offset = (vars.map.rect.min_X) - (vars.map.w / -2);
	vars.map.h_offset = (vars.map.rect.min_Y) - (vars.map.h / -2);
	vars.map.coverage = map_data_group.map_data_index.length/vars.map.sectors;

	k.set(vars.map.w_offset, vars.map.h_offset, 0.0);
	vars.map.c = k.clone();
	vars.map.data = map_data_group;

	vars.map.sector_dims = [
		(vars.map.w * (1/map_deg)),
		(vars.map.h * (1/map_deg))
	];

	console.log("vars.map.sector_dims", vars.map.sector_dims);

	// fucking mental
	const ax = vars.map.sector_dims[0];
	const ay = vars.map.sector_dims[1];
	vars.map.sector_array = Array.from({length: ay}, (_, i) => i)
		.map((e,i) => Array.from({length: ax}, (_, i) => (e*ax)+(i)));




	// const the_sector = UTIL.get_sector_from_world_point(vars.map, new THREE.Vector3(-10.1,-5.0,0));
	// console.log(the_sector);

	//#console.log("vars.map.real_sector_width",vars.map.sector_dims,p_memory);

	const geometry = new THREE.PlaneGeometry(vars.map.w, vars.map.h, 1, 1);
	map_plane = new THREE.Mesh(geometry, MATS.mapPlaneMaterial);
	map_plane.userData.name = 'map_plane';
	map_plane.position.copy(k);

	const map_max_dim = vars.map.w;// > vars.map.h ? vars.map.w : vars.map.h
	//+++++++++++++++++++++++++++++
	function build_map_sectors_and_tiles(data_index) {
		// now :{'id': 47, 'lv': [1, 2, 3, 4], 'dt': ['depths'], 'fl': ['urban'], 'au': ['places'], 'gd': ['guide-9']}
		vars.map.vertices = [];
		let sx = 0, sy = 0;

		for (let i = 0; i < vars.map.sectors; i++) {
			let x = i % (map_max_dim * (1/map_deg));
			let y = Math.floor(i / (map_max_dim * (1/map_deg)));
			sx = vars.map.rect.min_X + x*map_deg;
			sy = vars.map.rect.max_Y - y*map_deg;
			w.set(sx, sy, 0.0);
			vars.map.vertices.push(w.clone());

			const has_key = data_index.find(g => g.id === i);
			if(has_key) {
				let tile_vertices = [
					w.clone(),
					w.clone().setY(w.y - map_deg),
					w.clone().setX(w.x + map_deg).setY(w.y - map_deg),
					w.clone().setX(w.x + map_deg)
				]

				let loc = [vars.map.rect.min_X + x, vars.map.rect.min_Y + y];
				let name = 'M' + loc[0] + '_' + loc[1] + '_' + i;
				const new_tile = new classes.sector(name, loc, i, tile_vertices, has_key, vars, show_load);
				map_tiles_group.add(new_tile);
			}

		}

		let colors = new Float32Array(vars.map.vertices.length * 3);
		for (let c = 0; c < vars.map.vertices.length * 3; c += 3) {
			colors[c] = 1;
			colors[c + 1] = 0;
			colors[c + 2] = 1;
		}

		let pointsGeometry = new THREE.BufferGeometry().setFromPoints(vars.map.vertices);
		pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		map_points = new THREE.Points(pointsGeometry, MATS.pointsMaterial);
		map_points.userData.scans = true;
	}
	//+++++++++++++++++++++++++++++
	function build_map_guides(data) {
		map_guides = new THREE.Group();
		map_data_guides = new THREE.Group();
		let map_guides_vertices = [];
		let map_guides_shapes = [];

		let delta = [];

		for (let shape of data) {
			const points = shape.geom; //[2];
			let vertices = [];

			let subdelta = {'gid':shape.gid,'data':[]};

			for (let p = 0; p < points.length; p += 2) {
				v.set(points[p], points[p + 1], 0.0);//0.005);
				vertices.push(v.clone());

				subdelta.data.push([p, points[p], points[p + 1]]);

			}
			delta.push(subdelta);

			// vertices.reverse();
			// vertices.pop();
			const is_closed = shape.closed;

			if (vertices.length > 0) {
				const curve = new THREE.CatmullRomCurve3(vertices, true);
				curve.closed = is_closed;// shape[4];
				const len = curve.getLength();
				curve.arcLengthDivisions = vertices.length * vars.curve_segments;
				curve.updateArcLengths();

				let even_points = curve.getSpacedPoints(vertices.length/1);// / 10);// / 8);

				if (even_points.length > 1) {
					//#alert(shape[4]);
					if(is_closed) even_points.pop();

					const fine_curve = new THREE.CatmullRomCurve3(even_points, true);
					fine_curve.curveType = "catmullrom";
					fine_curve.tension = 0.0;
					fine_curve.closed = is_closed;// shape[4];
					fine_curve.arcLengthDivisions = even_points.length * vars.curve_segments;
					fine_curve.updateArcLengths();

					const curvePoints = fine_curve.getPoints(vertices.length * vars.curve_segments);
					const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
					const curveObject = new THREE.Line(geometry, MATS.mapGuidesMaterial);

					for (let p of fine_curve.points) {
						map_guides_vertices.push(p);
						map_guides_shapes.push(shape.shape);
					}

					curveObject.userData.guide = {
						'shape': shape.shape,
						'curve': fine_curve,
						'length': len.toFixed(4),
						'centroid': new THREE.Vector3().fromArray(UTIL.get_centroid(curvePoints)),
						'linked_places': []
					}
					map_guides.add(curveObject);
				}
			}
		}

		//exportToJsonFile(delta, 'guideo');

		map_guides.userData.shapes = map_guides_shapes;

		let pointsGeometry = new THREE.BufferGeometry().setFromPoints(map_guides_vertices);
		map_guides_verts = new THREE.Points(pointsGeometry, MATS.mapGuideVerticesMaterial);
	}
	//+++++++++++++++++++++++++++++
	console.log('map_data_group.map_guides', map_data_group.map_guides);
	if(map_data_group.map_guides) {
		build_map_guides(map_data_group.map_guides);
		map_group.add(map_guides_verts);
		map_group.add(map_guides);
		map_group.add(map_data_guides);
	}

	build_map_sectors_and_tiles(map_data_group.map_data_index);

	const brw = map_data_group.map_spec.includes_attributes;

	// #// GETTING TIME INDICES HERE
	const indices_load = Object.keys(brw)
		.filter((k) => brw[k].hasOwnProperty('time'))
		.map((k) => [`${k}_time_index`,`./data/med_mini_halfdeg_feb_2/${k}-indices.json`]);

	fetchAll(indices_load, show_load).then(result => {
		vars.data.update_frames = result;
		Object.keys(result).forEach((k) => vars.data[k] = result[k]);
	});

	map_group.add(map_points);
	map_group.add(map_tiles_group);
	map_group.add(map_plane);

	map_plane.visible = false;

	map_group.rotateX(Math.PI / -2);
	map_group.translateX(-vars.map.w_offset  * vars.map.s);
	map_group.translateY(-vars.map.h_offset  * vars.map.s);
	map_group.scale.set(vars.map.s, vars.map.s, vars.map.s);

	//console.log("total",vars.map.w * vars.map.h, "coverage", (vars.map.coverage*100).toFixed(2), '%');
	//console.log(vars.map);


	start();
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function make_menus(default_menu){
	// is default or not?
	let menu = default_menu[0];
	let struct = default_menu[1];
	let active = vars.map.hasOwnProperty('data') ? vars.map.data.map_spec.includes : [];

	menus = methods.make_ui_layers_panel(ui_el, state_keys_magic, active, menu, struct);

	for(let m in menus){
		state_keys[menus[m].key] = new classes.mini_toggle(m, vars, key_do_something, menus[m].default);
		menus[m].object.toggle_state('initial');
	}
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function add_maps_to_menus(data, default_menu=null){
	function map_info_filter(data){
		let pre = '';
		for(let d in data){
			pre += d+': ';
			if(typeof(data[d]) === 'object'){
				for(let e in data[d]) pre += data[d][e]+' ';
			}else{
				pre += data[d]+' ';
			}
			pre+='</br>';
		}
		return(pre);
	}

	const zone = data.map_information.maps;
	let dpk = {root:{maps:{}}};
	let map_menu = {
		root:{
			name:'menu',
			type:'static',
			default:true
		},
		maps:{
			name:'maps',
			type:'static',
			default:true
		}
	};
	if(default_menu){
		dpk = default_menu[1];
		dpk.root.maps = {};
		map_menu = default_menu[0];
		map_menu['maps'] = {
			name:'maps',
			type:'static',
			default:false
		}
	}
	for(let map in zone){
		map_menu[zone[map].name] = {
			name:zone[map].name,
			type:'static',
			default:false
		};
		map_menu[zone[map].name+'-data'] = {
			name:zone[map].name+'-data',
			type:'static',
			asset: map_info_filter(zone[map]),
			default:true
		}
		map_menu[zone[map].name+'-link'] = {
			name:zone[map].name+'-link',
			type:'static',
			asset:'[open]',
			link:`?map=${zone[map].name}`,
			default:true
		}
		dpk.root.maps[zone[map].name] = {};
		dpk.root.maps[zone[map].name][zone[map].name+'-data'] = {};
		dpk.root.maps[zone[map].name][zone[map].name+'-link'] = {};
	}
	return [map_menu, dpk];
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
const params = new Proxy(new URLSearchParams(window.location.search), {
	get: (searchParams, prop) => searchParams.get(prop),
});
const map_name = params.map;
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function preload_data_dependencies(presult){

	const base_map_resources = [
		['map_data_index', './data/'+map_name+'/map-digest.json'],
		['map_guides','./data/'+map_name+'/guides.json'],
		['map_information', './data/obspkg-maps.json']
	];

	const attrib_set = presult.map_spec.includes_attributes;

	const recall = Object.keys(attrib_set).filter(ak => attrib_set[ak].hasOwnProperty('time'));
	for(let t of recall){
		base_map_resources.push([t+'_indices', './data/'+map_name+'/'+t+'-indices.json']);
	}

	fetchAll(base_map_resources, show_load).then(result => {
		const stache = {...presult, ...result};
		build_map_group(stache, recall);
		make_menus(add_maps_to_menus(stache, methods.get_menu_defaults()))
	});


}






if(map_name){

	const base_map_resource = [
		['map_spec', './data/'+map_name+'/map-spec.json']
	];

	fetchAll(base_map_resource, show_load).then(result => {
		preload_data_dependencies(result);
	});

}else{

	const base_map_resources = [
		['map_information', './data/obspkg-maps.json']
	];

	fetchAll(base_map_resources, show_load).then(result => {
		make_menus(add_maps_to_menus(result));
	});

}
