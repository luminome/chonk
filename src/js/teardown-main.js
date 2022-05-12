import {dragControls} from './drags.js';
import {keyControls} from './keys.js';
import * as THREE from 'three/build/three.module.js';///build/three.module.js'; ONLY ONCE
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
// import Stats from 'three/examples/jsm/libs/stats.module.js';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import {mergeBufferGeometries, mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {data_loader as fetchAll} from './data-loader.js';

// import * as UTIL from './utilities.js';
// import * as MATS from './materials.js';
import * as classes from './classes.js';
import * as methods from './ui_methods.js';


import {make, teardown_particle, make_cloud} from './teardown-functions.js';
import {vars} from './vars-slim.js';


"use strict";

let dragControlsEnabled = true;

let menus = {};

let camera, scene, renderer, stats, cube, raycaster, user_position_marker, user_mouse_marker, nice_arrow, nice_arrow_mini;
let box_helper, grid_helper_x, grid_helper_y, grid_helper_z, arrow_helper, arrow_helper_2, arrow_helper_3, markers_group, north_mark;
let map_tiles_group, map_group, map_plane, map_points, map_guides, map_guides_verts;
let state_keys, gen_keys;
let transformControl;
let helper_sphere;
let test_particle, party, cloud_mesh, particles;

let load_counter = 0;
let load_scope = 0;

const loader = document.getElementById("load_bar");

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







map_group = new THREE.Group();
party = new THREE.Group();
map_tiles_group = new THREE.Group();

const particle_dummy = new THREE.Object3D();


const k_rand = (e) => (e/2)-(Math.random()*e);

//handle camera
const cube_box = new THREE.BoxGeometry(2, 2, 2);
cube = new THREE.Mesh(cube_box, new THREE.MeshStandardMaterial({color: 0xffffff}));
//cube.rotateX(Math.PI / -2);

let cam_base_pos = new THREE.Vector3(0, 0, vars.view.base_pos);
let cam_pos = new THREE.Vector3(0, 0, vars.view.base_pos);

const camera_frustum = new THREE.Frustum();
const camera_frustum_m = new THREE.Matrix4();

const w = new THREE.Vector3();
const k = new THREE.Vector3();
const v = new THREE.Vector3();
const u = new THREE.Vector3(0, 1, 0);
const un = new THREE.Vector3(0, 0, 1);
const v_q = new THREE.Quaternion();
const color = new THREE.Color();

// axis_helper = new THREE.AxesHelper(10);

// const dir = new THREE.Vector3(0, 0, 1);
// const origin = new THREE.Vector3(0, 0, 0);
// const length = 2;
// let hex = 0xFFFF00;
// arrow_helper = new THREE.ArrowHelper(dir, origin, length, hex);
// arrow_helper.visible = true;
// arrow_helper_2 = new THREE.ArrowHelper(dir, origin, length * 0.5, hex);
// arrow_helper_2.visible = true;
// arrow_helper_3 = new THREE.ArrowHelper(dir, origin, length * 0.5, hex);
// arrow_helper_3.visible = true;

const ui_el = document.getElementById("layers_ui");
const log_field = document.getElementById('info');

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
		log_new = true;
		this.watch = null;
	}
}

const state_keys_magic = {
	vars_bool: function(state, name, value){
		vars[name] = state;
	},
	vars_number: function(state, name, value){
		console.log(state, name, parseFloat(value));
		vars[name] = parseFloat(value);
	},
	grid: function(state, name, value){
		vars[name] = state;
		if(grid_helper_x && grid_helper_x.hasOwnProperty('visible')) grid_helper_x.visible = state;
		if(grid_helper_y && grid_helper_y.hasOwnProperty('visible')) grid_helper_y.visible = state;
		if(grid_helper_z && grid_helper_z.hasOwnProperty('visible')) grid_helper_z.visible = state;
		if(box_helper && box_helper.hasOwnProperty('visible')) box_helper.visible = state;
	},
	wind_source: function(state, name, value) {
		vars[name] = state;
		if(helper_sphere && helper_sphere.hasOwnProperty('visible')) helper_sphere.visible = state;
	},
	arrows: function(state, name, value){
		vars[name] = state;
		if(map_group && map_group.hasOwnProperty('visible')) map_group.children.forEach((a) => {
			if(a.marker.visible) a.arrow.visible = state;
		});
	},
	sectors: function(state, name, value){
		vars[name] = state;
		if(map_group && map_group.hasOwnProperty('visible')) map_group.children.forEach((a) => a.marker.visible = state);
	},
	particles: function(state, name, value){
		vars[name] = state;
		if(cloud_mesh && cloud_mesh.hasOwnProperty('visible')) cloud_mesh.visible = state;
		//map_group.children.forEach((a) => a.marker.visible = state);
	}
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function init() {
	const log_vars = [
		'any',
		'pos',
		'src',
		'inst'
	];

	for (let e of log_vars) {
		log[e] = (new log_var(e))
	}
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
			//log.zoom.echo([zz, 'level-' + vars.user.zoom_level]);

		// } else {
		// 	log.zoom.unwatch();
		}

		if (type === 'clicked') vars.user.mouse.clicked = true;

		vars.user.mouse.state = type;
		vars.user.mouse.x = (deltaX / vars.view.width) * 2 - 1;
		vars.user.mouse.y = (-deltaY / vars.view.height) * 2 + 1;
		//
	}

	//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
	function getKeyActions(raw) {

	}

	//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
	camera = new THREE.PerspectiveCamera(50, vars.view.width / vars.view.height, 1, 1000);
	scene = new THREE.Scene();
	scene.background = new THREE.Color(vars.env_color);

	// user_position_marker = make_user_position_mark(1);
	// user_mouse_marker = make_user_position_mark(1);

	// nice_arrow = make_pointer_arrow();
	// nice_arrow_mini = make_pointer_arrow();
	// nice_arrow_mini.scale.set(0.01, 0.01, 0.01);
	// nice_arrow_mini.material.color.offsetHSL(0, 0, 1.0);
	//
	// north_mark = new THREE.Object3D();
	// loadSVG_sub('./img/north.svg');
	// scene.add(north_mark);

	// const triangle = make_markers_group();

	// scene.add(map_group);
	//
	// scene.add(arrow_helper);
	// scene.add(triangle);
	// scene.add(arrow_helper_2);
	// scene.add(arrow_helper_3);
	// scene.add(user_position_marker);
	// scene.add(user_mouse_marker);
	// scene.add(nice_arrow);
	// scene.add(nice_arrow_mini);

	// user_position_marker.position.copy(vars.user.position);

	const light = new THREE.PointLight(0xFFFFFF, 2); ///0xDB8B00
	light.position.set(0, 1000);
	scene.add(light);

	//scene.fog = new THREE.Fog( vars.env_color, 1, 40 );

	renderer = new THREE.WebGLRenderer();//{powerPreference: "high-performance", antialias: true});
	renderer.setPixelRatio(1);//window.devicePixelRatio);//(2)
	renderer.setSize(vars.view.width, vars.view.height);
	document.body.appendChild(renderer.domElement);


	dragControls(renderer.domElement, translateAction, cube, dragControlsEnabled);//camera_position
	renderer.domElement.dragControlsEnabled = true;

	keyControls(window, getKeyActions);

	raycaster = new THREE.Raycaster();
	raycaster.params.Line.threshold = 0.005;//0.025;


	vars.cell_size = make(map_group, vars);
	map_group.updateMatrixWorld();
	map_group.updateMatrix();
	scene.add(map_group);

	console.log(vars.cell_size);

	particles = make_cloud(party, vars);
	vars.particle_count = particles.length;
	cloud_mesh = party.children[0];
	scene.add(party);






	window.addEventListener('resize', onWindowResize);

	let geometry = new THREE.SphereGeometry( 0.25, 32, 16 );
	let material = new THREE.MeshBasicMaterial( { color: 0x666666 } );
	helper_sphere = new THREE.Mesh( geometry, material );
	helper_sphere.position.set(7,0,7);
	scene.add(helper_sphere);
	helper_sphere.visible = vars.wind_source;
	// geometry = new THREE.SphereGeometry( 0.05, 32, 16 );
	// material = new THREE.MeshBasicMaterial( { color: 0x666666 } );
	// party = new THREE.Mesh( geometry, material );
	// scene.add(party);

	cam_base_pos.setZ(vars.view.base_pos);
	cam_pos.setY(vars.view.base_pos);

// 		let cam_base_pos = new THREE.Vector3(0, 0, vars.view.base_pos);
// let cam_pos = new THREE.Vector3(0, vars.view.base_pos, 0);

	const col_xy = new THREE.Color("hsl(306, 100%, 30%)");
	const col_gd = new THREE.Color("hsl(306, 100%, 15%)");

	grid_helper_x = new THREE.GridHelper( 2*vars.cell_size, vars.cell_size, col_xy, col_gd );
	grid_helper_x.rotateZ(Math.PI / -2);
	grid_helper_x.visible = vars.grid;

	grid_helper_z = new THREE.GridHelper( 2*vars.cell_size, vars.cell_size, col_xy, col_gd );
	grid_helper_z.rotateX(Math.PI / -2);
	grid_helper_z.visible = vars.grid;

	grid_helper_y = new THREE.GridHelper( 2*vars.cell_size, vars.cell_size, col_xy, col_gd );
	grid_helper_y.visible = vars.grid;

	scene.add( grid_helper_x );
	scene.add( grid_helper_y );
	scene.add( grid_helper_z );



	const box = new THREE.Box3();
	box.setFromCenterAndSize(
		new THREE.Vector3( 0, 0, 0 ),
		new THREE.Vector3( 2*vars.cell_size, 2*vars.cell_size, 2*vars.cell_size )
	);
	box_helper = new THREE.Box3Helper(box, col_gd);
	scene.add( box_helper );
	box_helper.visible = vars.grid;
	//axis_helper = new THREE.AxesHelper(vars.cell_size);
	//scene.add( axis_helper );



	transformControl = new TransformControls( camera, renderer.domElement );
	//transformControl.addEventListener( 'change', render );
	transformControl.addEventListener( 'dragging-changed', function ( event ) {
		renderer.domElement.dragControlsEnabled = ! event.value;
	} );
	transformControl.addEventListener( 'objectChange', function () {
		helper_sphere.userData.change = true;
	} );
	transformControl.addEventListener( 'mouseUp', function () {
		helper_sphere.userData.change = false;
		//transformControl.detach();
	} );

	scene.add( transformControl );

	transformControl.attach(helper_sphere);

	scene.updateMatrixWorld();

}

function get_effect(){
	const pk = helper_sphere.position.toArray()
	//const pk = la.map((l) => Math.round(l));
	const ost = (vars.cell_size-1)/2;
	let kx = null;
	let ky = null;
	let kz = null;
	let a = 0;

	if((pk[0] > (2*ost))) kx = vars.cell_size-1;
	if((pk[0] < (-2*ost))) kx = 0;

	if((pk[1] > (2*ost))) ky = vars.cell_size-1;
	if((pk[1] < (-2*ost))) ky = 0;

	if((pk[2] > (2*ost))) kz = vars.cell_size-1;
	if((pk[2] < (-2*ost))) kz = 0;

	const ref = map_group.children.filter((k) => k.locx[0] === kx || k.locx[1] === ky || k.locx[2] === kz);
	ref.forEach((r) => {
		v.set(
			r.locx[0] === kx ? (kx-ost)*-1 : 0.0,
			r.locx[1] === ky ? (ky-ost)*-1 : 0.0,
			r.locx[2] === kz ? (kz-ost)*-1 : 0.0
		);
		w.copy(r.position).multiplyScalar(2);
		k.subVectors(w, helper_sphere.position);
		a = k.angleTo(v);
		r.temp_v.lerp(v.normalize(), 0.05);//helper_sphere.position);// = 1.0-(a/(Math.PI/2));
		r.scalar = 1.0-(a/(Math.PI/2));///1/(a);//Math.PI);//vars.cell_size/helper_sphere.position.length()
		r.temp_w.copy(k.multiplyScalar(r.scalar));
	});
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function onWindowResize() {
	vars.view.reset();
	camera.aspect = vars.view.width / vars.view.height;
	camera.updateProjectionMatrix();
	renderer.setSize(vars.view.width, vars.view.height);
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function animate(a) {
	requestAnimationFrame(animate);
	render(a);
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

const colossus_of_pete = new THREE.Vector3();
let frame_counter = 0;

function frame(){

	ctr.v++;
	const k_rand = (e) => (e/2)-(Math.random()*e);
	const nd = [k_rand(vars.cell_size*4), k_rand(vars.cell_size*4), k_rand(vars.cell_size*4)];
	colossus_of_pete.fromArray(nd);
	if(!helper_sphere.userData.change){
		transformControl.detach();
	}

	if(vars.data_driven){
		map_group.children.filter((k) => k.hasOwnProperty('pseudo')).forEach((c) => c.set_data_from_fragment(frame_counter));
		frame_counter++;
		if(frame_counter>26) frame_counter = 0;
	}

	// these_cells[u].set_data_from_fragment(0);
	// set_sphere_pos();
	// get_effect();
	// const rnd = Math.floor(Math.random()*map_group.children.length);
	//
	// vars.sel_fixed = rnd;
	// vars.sel_hue = Math.random()*0.5;
	//
	// log.any.echo([rnd, vars.sel_hue]);
	//map_tiles_group.children.forEach(t => t.update_frame('sst',ctr.v));
	//map_tiles_group.children.forEach(t => t.update_frame('wind', ctr.v));
}

function render(a) {

	pulse(a);

	if(!vars.data_driven) get_effect();

	v_q.setFromUnitVectors(u, vars.user.position.clone().normalize());
	cam_pos.lerp(cam_base_pos.clone().applyQuaternion(cube.quaternion), 0.1);
	camera.up.lerp(u.clone().applyQuaternion(cube.quaternion), 0.1);
	camera.position.addVectors(cam_pos, vars.user.position);
	camera.lookAt(vars.user.position);

	raycaster.setFromCamera(vars.user.mouse, camera);
	camera.updateMatrix();
	camera.updateMatrixWorld();

	camera_frustum.setFromProjectionMatrix(camera_frustum_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

	// test_particle.idle();
	// party.position.copy(test_particle)



	let g_pl = raycaster.intersectObject(map_group);
	let rps = [];
	vars.sel = null;
	//log.pos.echo(g_pl);


	if (g_pl.length) {
		for (let p of g_pl) {
			if (p.hasOwnProperty('object')) {
				if(p.object.userData.hasOwnProperty('cell_id')){
					if(p.object.visible === true) {
						const rdat = Object.entries(p.object.userData);
						if (rdat.length) rps.push(rdat);
					}
				}
			}
		}
		//if(g_pl[0].object.hasOwnProperty('marker') && g_pl[0].object.marker.visible)
		//vars.sel = g_pl[0].object.userData.cell_id;
		//const r_cell = map_group.children[vars.sel];

		// rps.push(r_cell.position.x);
		// rps.push(r_cell.temp_v.toArray());
		// rps.push(r_cell.temp_a);
		log.pos.echo(rps[0]);
	}else{
		log.pos.unwatch();
	}


	g_pl = raycaster.intersectObject( helper_sphere, false );
	if(g_pl.length){
		const object = g_pl[ 0 ].object;
		if ( object !== transformControl.object ) {
			transformControl.attach(object);
		}
	}
	// const rnd = Math.floor(Math.random()*map_group.children.length);
	// map_group.children[rnd].update(vars.sel_fixed);

	for (let cell of map_group.children) {
		//cell.marker.scale.setScalar(vars.sector_size);
		if(!vars.three_d && cell.locx[1] !== (vars.cell_size/2)-1) cell.marker.visible = false;
		cell.idle(vars.sel_fixed);
		cell.update(vars.sel_fixed);
		//cell.temp_w.copy(helper_sphere.position).normalize().multiplyScalar(-cell.scalar);
	}

	// if(vars.sel && vars.sel !== vars.sel_fixed) { ///vars.user.mouse.clicked &&
	// 	//map_group.children[vars.sel].update();
	// 	vars.sel_fixed = vars.sel*1.0;
	// 	vars.sel_hue = Math.random();//*0.5;
	// 	vars.user.mouse.clicked = false;
	// 	transformControl.detach();
	// }
	//
	// map_group.children[vars.sel_fixed].scalar = 2.0;
	// map_group.children[vars.sel_fixed].hue = vars.sel_hue;
	if(cloud_mesh){
		let i = 0;
		let p_inst_list = [];


		for(let p of particles){
			//v.copy(helper_sphere.position);


			const s = p.get_sector();
		//let lightness = vars.particle_windy_mode ? p.flow*(p.delta_p*4.0) : (p.delta_p);



			if(typeof(s) === 'number' && s < Math.pow(vars.cell_size,3)) {
				//..log.any.echo()
				//let dl = w.subVectors(map_group.children[s].position.clone().multiplyScalar(2), p).length();
				//log.any.echo([dl]);
				//k.copy(v.normalize().multiplyScalar(-map_group.children[s].scalar));
				//let fz = vars.particle_propagate ? 0.15 : map_group.children[s].scalar;
				//v.copy(map_group.children[s].temp_w.clone());//.normalize();
				// w.copy(p);
				// v.addVectors(map_group.children[s].temp_w.clone().multiplyScalar(map_group.children[s].scalar*4.0), w);//p.initial.copy(v.multiplyScalar((fz*vars.particle_rate_factor)));
				// //
				// //p.initial.copy(v);
				//
				// if(a % p.refresh === 0){
				//
				// 	//log.any.echo(p.toArray());
				// }

				// v.copy();
				p.initial.copy(map_group.children[s].temp_w);//.clone());//.multiplyScalar(map_group.children[s].scalar));//.normalize();

				//v.copy(map_group.children[s].temp_w).multiplyScalar(fz*vars.particle_rate_factor);
				///;/map_group.children[s].scalar/5);//map_group.children[s].scalar);
				//v.multiplyScalar(-map_group.children[s].scalar);
				//p.initial.lerp(k, 0.01);
				//p.initial.copy(v);//lerp(v, 0.009);//0.009);
				//}

			}

			// p.idle();
			//
			// p.swing(null, a);
			//
			p.move();
			let lightness = p.flow * p.delta_p * vars.particle_intensity;// < 0.5 ? p.delta_p*6.0 : 0.0;//0.5;//p.delta_p > 1 ? 1 :p.delta_p;
			color.setHSL(0.6, 1.0 , lightness);

			//log.any.echo([p.delta_p]);

			particle_dummy.scale.setScalar(vars.particle_size);
			particle_dummy.position.copy(p);
			particle_dummy.updateMatrix();

			cloud_mesh.setMatrixAt( i, particle_dummy.matrix );
			cloud_mesh.setColorAt( i, color.clone() );
			i++;

		}
		cloud_mesh.instanceMatrix.needsUpdate = true;
		cloud_mesh.instanceColor.needsUpdate = true;
		//log.inst.echo(p_inst_list);
	}

	if(helper_sphere.userData.change){
		colossus_of_pete.copy(helper_sphere.position);
	}else{
		helper_sphere.position.lerp(colossus_of_pete,0.05);
	}
	log_display();
	renderer.render(scene, camera);
}

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function start() {
	// vars.sel_fixed = 0.0;
	// vars.sel_hue = 0.0;
	// vars.sector_carry = 1.0;
	init();
	animate();
}
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function make_menus(default_menu){
	// is default or not?
	let menu = default_menu[0];
	let struct = default_menu[1];
	menus = methods.make_ui_layers_panel(ui_el, state_keys_magic, [], menu, struct);
	for(let m in menus){
		menus[m].object.toggle_state('initial');
	}
}

let dpk = {
	root:{
		grid:{},
		three_d:{},
		data_driven:{},
		wind_source:{},
		arrows:{},
		sectors:{},
		particles:{},
		variables:{
			particle_vars:{
				//particle_propagate:{},
				//particle_randomize:{},
				//particle_windy_mode:{},
				particle_size:{},
				particle_intensity:{},
				//particle_entropy:{},
				particle_inheritance:{},
				particle_refresh_rate:{},
				particle_rate_factor:{},
				particle_decay_factor:{}
			},
			global_vars:{
				sector_size: {},
				sector_carry: {},
				update_frequency: {}
			}
		}
	}
};

let map_menu = {
	root:{
		name:'menu',
		type:'static',
		default:true
	},
	grid:{
		name:'grid',
		type:'static',
		default:true,
		custom: true
	},
	wind_source:{
		name:'wind source marker',
		type:'static',
		default:false,
		custom: true
	},
	arrows:{
		name:'arrows',
		type:'static',
		default:false,
		custom: true
	},
	sectors:{
		name:'sectors',
		type:'static',
		default:false,
		custom: true
	},
	three_d:{
		name:'3d view',
		type:'static',
		default:false,
		custom: 'vars_bool'
	},
	particles:{
		name:'particles',
		type:'static',
		default:true,
		custom: true
	},
	particle_vars:{
		name:'particle settings',
		type:'static',
		default:false,
		custom: true
	},
	global_vars:{
		name:'global settings',
		type:'static',
		default:false,
		custom: true
	},
	variables:{
		name:'variables',
		type:'static',
		default:false,
		custom: true
	},
	particle_size: {
		name: 'particle size',
		default: true,
		is_variable: "0.5",
		units:'screen',
		type: 'static',
		custom: 'vars_number'
	},
	sector_size: {
		name: 'sector size',
		default: true,
		is_variable: "1",
		units:'screen',
		type: 'static',
		custom: 'vars_number'
	},
	sector_carry: {
		name: 'sector inheritance',
		default: true,
		is_variable: "5",
		units:'delta',
		type: 'static',
		custom: 'vars_number'
	},
	update_frequency: {
		name: 'direction change frequency',
		default: true,
		is_variable: "300",
		units:'ms',
		type: 'static',
		custom: 'vars_number'
	},
	particle_entropy: {
		name: 'particle entropy',
		default: true,
		is_variable: "0.005",
		units:'screen',
		type: 'static',
		custom: 'vars_number'
	},
	particle_refresh_rate: {
		name: 'particle refresh',
		default: true,
		is_variable: "180",
		units:'delta',
		type: 'static',
		custom: 'vars_number'
	},
	particle_rate_factor: {
		name: 'particle rate factor',
		default: true,
		is_variable: "1",
		units:'delta',
		type: 'static',
		custom: 'vars_number'
	},
	particle_intensity: {
		name: 'particle intensity',
		default: true,
		is_variable: "4",
		units:'screen',
		type: 'static',
		custom: 'vars_number'
	},
	particle_inheritance: {
		name: 'sector vector inherit amt.',
		default: true,
		is_variable: "5",
		units:'screen',
		type: 'static',
		custom: 'vars_number'
	},
	particle_decay_factor: {
		name: 'particle decay factor',
		default: true,
		is_variable: "0.99",
		units:'delta',
		type: 'static',
		custom: 'vars_number'
	},
	particle_propagate: {
		name: 'follow sector vector',
		default: false,
		type: 'static',
		custom: 'vars_bool'
	},
	particle_randomize: {
		name: 'randomized reset (no wrap)',
		default: true,
		type: 'static',
		custom: 'vars_bool'
	},
	particle_windy_mode: {
		name: 'windy mode',
		default: false,
		type: 'static',
		custom: 'vars_bool'
	},
	data_driven: {
		name: 'use data',
		default: true,
		type: 'static',
		custom: 'vars_bool'
	},
};

make_menus([map_menu,dpk]);
start();

const base_map_resources = [
	['map_spec', './data/marseille/map-digest-sst.json'],
];



function n_vvct(w_value){
	let cpv = w_value.split(' ');
	const U = parseFloat(cpv[0]);
	const V = parseFloat(cpv[1]);

	const WDIR = 270 - (Math.atan2(-V, U) * (180 / Math.PI));
	const WLEN = Math.sqrt(Math.pow(U, 2) + Math.pow(V, 2));

	//this.scalar = WLEN;
	v.set(0,1,0);
	w.set(WLEN,0,0);
	w.applyAxisAngle(v, WDIR*(Math.PI/180));
	return w.clone();
}

fetchAll(base_map_resources, show_load).then(result => {
	/**/
	const these_cells = map_group.children.filter((k) => k.hasOwnProperty('pseudo'));
	//console.log(result);
	//vars.cell_size = 16;

	let inc = 1;
	let data = null;
	let ctrx = 0;
	let oft = 0;
	let maxes = [];

	for(let u = 0; u < 64; u++){

		//have 64 entries per resolution interval.
		//looking for 16x
		//0,1
		//16,17



		let r = inc+(u*2);
		data = result['map_spec'][r];
		//console.log(data);
		oft = Math.floor(u/8)*16;

		let sets = [[],[],[],[]];

		for(let line of data){
			const ces = [n_vvct(line[0][0]), n_vvct(line[0][1]), n_vvct(line[1][0]), n_vvct(line[1][1])];
			const maxValueOfY = Math.max(...ces.map(o => o.length()), 0);
			maxes.push(maxValueOfY);
			sets.map((v,i) => v.push(ces[i]) );
		}




		const ces = [data[0][0][0], data[0][0][1], data[0][1][0], data[0][1][1]];
		const cap = [ctrx+oft, ctrx+oft+1, ctrx+oft+16, ctrx+oft+17];

		//list.map((currElement, index) =>

		//ces.map((v,i) => console.log(i,cap[i],v));		// these_cells[u].data_fragment = data;
		sets.map((v,i) => {
			//console.log(cap[i]);
			these_cells[cap[i]].data_fragment = v;
			//these_cells[cap[i]].set_data_from_fragment(0);
		});		// these_cells[u].data_fragment = data;
		// these_cells[u].set_data_from_fragment(0);

		//c//onsole.log(oft,[ctrx+oft,ctrx+oft+1,ctrx+oft+16,ctrx+oft+17]);





		// const mc_index = these_cells[u].cell_id;
		//
		// //console.log(u,r,data);
		// // map_group.children[mc_index].data_fragment = data;
		// // map_group.children[mc_index].set_data_from_fragment(1);
		//

		ctrx += 2;

	}

	// console.warn(maxes);
	//
	//
	// console.warn(Math.max(...maxes), Math.min(...maxes));//sets);
	vars.wind_max = Math.max(...maxes);
	vars.wind_min = Math.min(...maxes);

	for(let line of these_cells) {
		line.set_data_from_fragment(0);
	}



});



//whoa.
