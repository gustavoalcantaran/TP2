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

//Função de Geração Procedimental
//Vai devolver o mesmo número entre 0 e 1 para as mesmas coodernada X e Z
function pseudoRandom(x, z) {
    let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

// --- CRIAÇÃO DOS OBJETOS 3D ---
// Chão (Plane): O "10, 10" no final significa poucas subdivisões (ideal para low-poly!)
const chaoBuffer = primitives.createPlaneBufferInfo(gl, 400, 400, 10, 10);

// --- CRIAÇÃO DO OVNI ---
// 1. Corpo/Chassi:
const corpoOvniBuffer = primitives.createTruncatedConeBufferInfo(gl, 2.3, 2, 0.5, 20, 1);
// 2. Cabine : 
const cabineOvniBuffer = primitives.createSphereBufferInfo(gl, 1.5, 30, 30);
// 3. Anel :
const anelOvniBuffer = primitives.createTorusBufferInfo(gl, 3.5, 0.2, 10, 12);

// --- OBJETOS DA FAZENDA ---

// --- SILO ---
const siloCilindroBuffer = primitives.createCylinderBufferInfo(gl,2,6,16,1);
const siloTetoBuffer = primitives.createSphereBufferInfo(gl, 2, 16, 16);
function desenharSilo(viewProjectionMatrix, posX, posZ){
    let matrizCorpo = m4.translation([posX,3,posZ]);
    let finalMatrixCorpo = m4.multiply(viewProjectionMatrix, matrizCorpo);

    setBuffersAndAttributes(gl, programInfo, siloCilindroBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCorpo,
        u_color: [0.7, 0.7, 0.7, 1],
    });
    drawBufferInfo(gl, siloCilindroBuffer);

    let matrizTeto = m4.translation([posX, 6, posZ]);
    let finalMatrixTeto = m4.multiply(viewProjectionMatrix, matrizTeto);
    
    setBuffersAndAttributes(gl, programInfo, siloTetoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixTeto,
        u_color: [0.5, 0.5, 0.5, 1], // Cinza mais escuro
    });
    drawBufferInfo(gl, siloTetoBuffer);
}

// --- CELEIRO ---
const celeiroCorpoBuffer = primitives.createCubeBufferInfo(gl,4);
const celeiroTetoBuffer = primitives.createTruncatedConeBufferInfo(gl,3.5, 0, 2, 4, 1);
function desenharCeleiro(viewProjectionMatrix, posX, posZ){
    let matrizCorpo = m4.translation([posX, 2, posZ]);
    let finalMatrixCorpo = m4.multiply(viewProjectionMatrix, matrizCorpo);
    setBuffersAndAttributes(gl, programInfo, celeiroCorpoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCorpo,
        u_color: [0.7, 0.1, 0.1, 1],
    });
    drawBufferInfo(gl, celeiroCorpoBuffer);

    let matrizTeto = m4.translation([posX, 5, posZ]);
    matrizTeto = m4.rotateY(matrizTeto, Math.PI / 4);
    let finalMatrixTeto = m4.multiply(viewProjectionMatrix, matrizTeto);
    setBuffersAndAttributes(gl, programInfo, celeiroTetoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixTeto,
        u_color: [0.3, 0.2, 0.1, 1],
    });
    drawBufferInfo(gl, celeiroTetoBuffer);
}

// --- ÁRVORE --- 
const troncoBuffer = primitives.createCylinderBufferInfo(gl, 0.5, 2, 6, 1); // Raio 0.5, Altura 2
const folhasBuffer = primitives.createTruncatedConeBufferInfo(gl, 2, 0, 3, 6, 1); // Raio base 2, topo 0, Altura 3
function desenharArvore(viewProjection, posX, posZ){
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

// -- DISTRIBUIÇÃO HARMÔNICA (ESTILO SPORE)
const tamanhoLote = 20;
const colunas = 15;
const linhas = 15;
const limiteTras = 40;
const metadeX = (colunas * tamanhoLote) / 2;

const objetosFazenda = [];

for(let l = 0; l < linhas; l++){
    for(let c = 0; c < colunas; c++){
        let obj = {coluna : c, linha : l};
        atualizarObjetoFazena(obj);
        objetosFazenda.push(obj);
    }
}

function atualizarObjetoFazena(obj){

    let desvioX = (pseudoRandom(obj.coluna, obj.linha) - 0.5) * 16;
    let desvioZ = (pseudoRandom(obj.coluna + 73, obj.linha + 42) - 0.5) * 16;
    obj.x = (obj.coluna*tamanhoLote - metadeX) + desvioX;
    obj.z = (-obj.linha*tamanhoLote) + desvioZ;

    let chance = pseudoRandom(obj.coluna+100, obj.linha+200);
    if (chance > 0.97) obj.tipo = 'silo';
    else if (chance > 0.93) obj.tipo = 'celeiro';
    else obj.tipo = 'arvore';
}

// --- CONFIGURAÇÃO DA NAVE ---
let navePos = [0,20,0];
let tempoAnterior = 0;
const velocidadeOvni = 20;
let inclinacaoAtualX = 0;
let inclinacaoAtualZ = 0;

// --- CONFIGURAÇÃO DE CÂMERA ---
let cameraAtual = 2;
let cameraC = 0; // Variável para alternar entre as câmeras

// --- LEITURA DE TECLAS ---
const teclasPressionadas = {};
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1) {
        e.preventDefault();
    }
    teclasPressionadas[key] = true;
});
window.addEventListener('keyup', (e) => {
    teclasPressionadas[e.key.toLowerCase()] = false;
});

// --- GAME LOOP ---
function render(time) {
    time *= 0.001; // Converte o tempo para segundos
    const deltaTime = time - tempoAnterior;
    tempoAnterior = time;

    
    // Ajusta o tamanho do canvas para não ficar borrado
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // --- Controles de voo ---
    let inclinacaoAlvoX = 0;
    let inclinacaoAlvoZ = 0;

    if(teclasPressionadas['w'] == true || teclasPressionadas['arrowup']){
        navePos[2] -= velocidadeOvni * deltaTime;
        inclinacaoAlvoX = -0.3; // Inclina para frente
    }
    if(teclasPressionadas['s'] == true || teclasPressionadas['arrowdown']){
        navePos[2] += velocidadeOvni * deltaTime;
        inclinacaoAlvoX = 0.3; // Inclina para trás
    }
    if(teclasPressionadas['a'] == true || teclasPressionadas['arrowleft']){
        navePos[0] -= velocidadeOvni * deltaTime;
        inclinacaoAlvoZ = 0.3; // Inclina para a esquerda
    }
    if(teclasPressionadas['d'] == true || teclasPressionadas['arrowright']){
        navePos[0] += velocidadeOvni * deltaTime;
        inclinacaoAlvoZ = -0.3; // Inclina para a direita
    }

    
    //Suavização das inclinações
    inclinacaoAtualX += (inclinacaoAlvoX - inclinacaoAtualX) * deltaTime * 5;
    inclinacaoAtualZ += (inclinacaoAlvoZ - inclinacaoAtualZ) * deltaTime * 5;
    
    // --- CÂMERA E PROJEÇÃO ---
    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fov, aspect, 0.1, 200);
    
    // --- Controle de Câmera ---
    let offset, up;

    if (teclasPressionadas['1'] == true){
        cameraAtual = 1;
    }
    if (teclasPressionadas['2'] == true){
        cameraAtual = 2;
    }
    if (teclasPressionadas['c'] == true){
        if(cameraAtual == 2){
            cameraC = (cameraC + 1) % 4; // Alterna entre as 4 posições da câmera
        }
        teclasPressionadas['c'] = false; // Evita múltiplos incrementos por frame
    }

    switch(cameraAtual){
        case 1: 
            offset = [0, 40, 0];
            up = [0, 0, -1];
            break;
        case 2:
            switch(cameraC){
                case 0:
                    offset = [0, 10, 20];
                    up = [0, 1, 0];
                    break;
                case 1:
                    offset = [0, 10, -20];
                    up = [0, 1, 0];
                    break;
                case 2:
                    offset = [20, 10, 0];
                    up = [0, 1, 0];
                    break;
                case 3:
                    offset = [-20, 10, 0];
                    up = [0, 1, 0];
                    break;
            }
            break;
    }

    const cameraPosition = [
        navePos[0] + offset[0],
        navePos[1] + offset[1],
        navePos[2] + offset[2]
    ]
    const target = navePos;

    const camera = m4.lookAt(cameraPosition, target, up);
    const view = m4.inverse(camera);
    const viewProjection = m4.multiply(projection, view);

    // --- DESENHAR O CHÃO ---
    const tamanhoPoligono = 10;
    const chaoZ = Math.round(navePos[2]/tamanhoPoligono) * tamanhoPoligono;
    const chaoX = Math.round(navePos[0]/tamanhoPoligono) * tamanhoPoligono;
    let matrixChao = m4.translation([chaoX, 0, chaoZ]);
    let finalMatrixChao = m4.multiply(viewProjection, matrixChao);
    
    setBuffersAndAttributes(gl, programInfo, chaoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixChao,
        u_color: [0.3, 0.8, 0.4, 1], // Verde grama
    });
    drawBufferInfo(gl, chaoBuffer);

    // --- DESENHAR OBJETOS ---
    const posCameraZ = cameraPosition[2];
    const posCameraX = cameraPosition[0];
    const tamanhoTotalZ = linhas * tamanhoLote;
    const tamanhoTotalX = colunas * tamanhoLote;

    for (let i = 0; i < objetosFazenda.length; i++){
        let obj = objetosFazenda[i];
        if (obj.z > posCameraZ + limiteTras){
            obj.linha += linhas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.z < posCameraZ - tamanhoTotalZ + limiteTras){
            obj.linha -= linhas;
            atualizarObjetoFazena(obj);
        }
        if(obj.x < posCameraX - metadeX){
            obj.coluna += colunas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.x > posCameraX + metadeX){
            obj.coluna -= colunas;
            atualizarObjetoFazena(obj);
        }
        if (obj.tipo == 'arvore'){
            desenharArvore(viewProjection, obj.x, obj.z);
        }
        else if (obj.tipo == 'silo'){
            desenharSilo(viewProjection, obj.x, obj.z);
        }
        else if (obj.tipo == 'celeiro'){
            desenharCeleiro(viewProjection, obj.x, obj.z);
        }
    }

    // --- DESENHAR O OVNI ---
    //Controla a posição global do OVNI no mundo
    let matrizBaseOvni = m4.translation(navePos);
    //Leve inclinação para parecer que está voando
    matrizBaseOvni = m4.rotateX(matrizBaseOvni, inclinacaoAtualX);
    matrizBaseOvni = m4.rotateZ(matrizBaseOvni, inclinacaoAtualZ);
    matrizBaseOvni = m4.rotateY(matrizBaseOvni, Math.sin(time * 2) * 0.05);

    // Desenhar o corpo
    let finalMatrixCorpo = m4.multiply(viewProjection, matrizBaseOvni);
    setBuffersAndAttributes(gl, programInfo, corpoOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCorpo,
        u_color: [0.6, 0.6, 0.6, 1], // Cinza
    });
    drawBufferInfo(gl, corpoOvniBuffer);

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

    // Desenhar a cabine
    let matrizCabine = m4.translate(matrizBaseOvni, [0, 0.8, 0]);
    let finalMatrixCabine = m4.multiply(viewProjection, matrizCabine);
    setBuffersAndAttributes(gl, programInfo, cabineOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixCabine,
        u_color: [0.2, 0.8, 0.8, 0.4], // Ciano
    });
    drawBufferInfo(gl, cabineOvniBuffer);

    gl.disable(gl.BLEND);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);