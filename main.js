import { m4, primitives, createProgramInfo, resizeCanvasToDisplaySize, setBuffersAndAttributes, setUniforms, drawBufferInfo } from './libs/twgl.full.module.js';

// --- SHADERS ---
const vsSource = `
uniform mat4 u_worldViewProjection;
attribute vec4 position;

void main() {
    gl_Position = u_worldViewProjection * position;
}
`;

// --- FRAGMENT SHADER ---
const fsSource = `
precision mediump float;
uniform vec4 u_color;

void main() {
    gl_FragColor = u_color;
}
`;

// --- CONFIGURAÇÃO INICIAL ---
const canvas = document.getElementById("gameCanvas");
const gl = canvas.getContext("webgl2");

// Verifica se o WebGL2 está funcionando
if (!gl) {
    alert("Seu navegador não suporta WebGL2!");
}

// Compila os shaders magicamente
const programInfo = createProgramInfo(gl, [vsSource, fsSource]);

// --- CRIAÇÃO DOS OBJETOS 3D ---
// Chão (Plane): O "10, 10" no final significa poucas subdivisões (ideal para low-poly!)
const chaoBuffer = primitives.createPlaneBufferInfo(gl, 200, 200, 10, 10);

// --- CRIAÇÃO DO OVNI ---
// 1. Corpo/Chassi:
const corpoOvniBuffer = primitives.createTruncatedConeBufferInfo(gl, 2.3, 2, 0.5, 20, 1);
// 2. Cabine : 
const cabineOvniBuffer = primitives.createSphereBufferInfo(gl, 1.5, 30, 30);
// 3. Anel :
const anelOvniBuffer = primitives.createTorusBufferInfo(gl, 3.5, 0.2, 10, 12);

// Árvore (Low-poly)
const troncoBuffer = primitives.createCylinderBufferInfo(gl, 0.5, 2, 6, 1); // Raio 0.5, Altura 2
const folhasBuffer = primitives.createTruncatedConeBufferInfo(gl, 2, 0, 3, 6, 1); // Raio base 2, topo 0, Altura 3
function criarArvore(viewProjection, posX, posZ){
    // Desenha o tronco
    let matrixTronco = m4.translation([posX, 1, posZ]);
    let finalMatrixTronco = m4.multiply(viewProjection, matrixTronco);
    setBuffersAndAttributes(gl, programInfo, troncoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixTronco,
        u_color: [0.55, 0.27, 0.07, 1], // Marrom
    });
    drawBufferInfo(gl, troncoBuffer);

    // Desenha as folhas
    let matrixFolhas = m4.translation([posX, 3.5, posZ]);
    let finalMatrixFolhas = m4.multiply(viewProjection, matrixFolhas);
    setBuffersAndAttributes(gl, programInfo, folhasBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixFolhas,
        u_color: [0.2, 0.8, 0.2, 1], // Verde
    });
    drawBufferInfo(gl, folhasBuffer);

}

// --- CONFIGURAÇÃO DAS ÁRVORES ---
const quantidadeArvores = 50;
const arvores= [];
const profundidadeVisao = 120;

for(let i = 0; i < quantidadeArvores; i++){
        arvores.push({
        x : (Math.random() - 0.5) * 100, // Distribuição aleatória no eixo X
        z : -Math.random() * profundidadeVisao // Distribuição aleatória no eixo Z, mais próximas da nave
    });
}

// --- GAME LOOP ---
function render(time) {
    time *= 0.001; // Converte o tempo para segundos
    const navePos = [0, 5, (-time * 15)/4];
    // Ajusta o tamanho do canvas para não ficar borrado
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    // --- CÂMERA E PROJEÇÃO ---
    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fov, aspect, 0.1, 200);

    const offset = [10, 8, 0];
    const cameraPosition = [
        navePos[0] + offset[0],
        navePos[1] + offset[1],
        navePos[2] + offset[2]
    ]
    const target = navePos;
    const up = [0, 1, 0];
    
    const camera = m4.lookAt(cameraPosition, target, up);
    const view = m4.inverse(camera);
    const viewProjection = m4.multiply(projection, view);

    // --- DESENHAR O CHÃO ---
    const tamanhoPoligono = 10;
    const chaoZ = Math.round(navePos[2]/tamanhoPoligono) * tamanhoPoligono;
    let matrixChao = m4.translation([0, 0, chaoZ]);
    let finalMatrixChao = m4.multiply(viewProjection, matrixChao);
    
    setBuffersAndAttributes(gl, programInfo, chaoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixChao,
        u_color: [0.3, 0.8, 0.4, 1], // Verde grama
    });
    drawBufferInfo(gl, chaoBuffer);

    // --- DESENHAR AS ÁRVORES ---
    const posCameraZ = cameraPosition[2];
    for (let arvore of arvores){
        if(arvore.z > posCameraZ + 30){
            arvore.z = posCameraZ - profundidadeVisao; // Reposiciona a árvore para trás da visão
            arvore.x = (Math.random() - 0.5) * 200; // Nova posição X aleatória
        }
        criarArvore(viewProjection, arvore.x, arvore.z);
    }

    // --- DESENHAR O OVNI ---
    //Controla a posição global do OVNI no mundo
    let matrizBaseOvni = m4.translation(navePos);
    //Leve inclinação para parecer que está voando
    matrizBaseOvni = m4.rotateZ(matrizBaseOvni, Math.sin(time*2) * 0.05);

    // Desenhar o corpo
    let finalMatrixCorpo = m4.multiply(viewProjection, matrizBaseOvni);
    setBuffersAndAttributes(gl, programInfo, corpoOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCorpo,
        u_color: [0.6, 0.6, 0.6, 1], // Cinza
    });
    drawBufferInfo(gl, corpoOvniBuffer);

    // Desenhar a cabine
    let matrizCabine = m4.translate(matrizBaseOvni, [0, 0.8, 0]);
    let finalMatrixCabine = m4.multiply(viewProjection, matrizCabine);
    setBuffersAndAttributes(gl, programInfo, cabineOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCabine,
        u_color: [0.2, 0.8, 0.8, 1], // Ciano
    });
    drawBufferInfo(gl, cabineOvniBuffer);

    // Desenhar o anel
    let matrizAnel = m4.rotateY(matrizBaseOvni, time*5);
    matrizAnel = m4.rotateZ(matrizAnel, 0.05);
    let finalMatrixAnel = m4.multiply(viewProjection, matrizAnel);
    setBuffersAndAttributes(gl, programInfo, anelOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixAnel,
        u_color: [0.1, 0.9, 0.2, 1], // Verde neon
    });
    drawBufferInfo(gl, anelOvniBuffer);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);