import { m4, primitives, createProgramInfo, resizeCanvasToDisplaySize, setBuffersAndAttributes, setUniforms, drawBufferInfo } from './libs/twgl.full.module.js';

// --- SHADERS ---
const vsSource = `
precision mediump float;
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
attribute vec4 position;
attribute vec3 normal;
varying vec3 v_normal;

void main() {
    gl_Position = u_worldViewProjection * position;
    v_normal = mat3(u_world) * normal;
}
`;

// --- FRAGMENT SHADER ---
const fsSource = `
precision mediump float;

varying vec3 v_normal;
uniform vec3 u_lightDirection;
uniform vec4 u_color;

void main() {
    vec3 lightDir = normalize(-u_lightDirection);
    float brightness = dot(normalize(v_normal), lightDir);
    
    // 4 níveis de toon ao invés de 3
    float toon;
    if      (brightness > 0.85) toon = 1.0;
    else if (brightness > 0.55) toon = 0.7;
    else if (brightness > 0.20) toon = 0.4;
    else                        toon = 0.15;

    gl_FragColor = vec4(u_color.rgb * toon, u_color.a);
}
`;



// --- CONFIGURAÇÃO INICIAL ---
const canvas = document.getElementById("gameCanvas");
const gl = canvas.getContext("webgl2");

const vsOutline = `
precision mediump float;
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
attribute vec4 position;
attribute vec3 normal;

void main() {
    // Expande o objeto levemente ao longo das normais
    vec3 norm = normalize(mat3(u_world) * normal);
    vec4 pos = position + vec4(norm * 0.08, 0.0);
    gl_Position = u_worldViewProjection * pos;
}
`;

const fsOutline = `
precision mediump float;
void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Preto sólido
}
`;

const outlineProgramInfo = createProgramInfo(gl, [vsOutline, fsOutline]);

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

// --- FUNÇÃO PARA CRIAR OUTLINE ---
function desenharComOutline(bufferInfo, worldMatrix, viewProjection, color) {
    const wvp = m4.multiply(viewProjection, worldMatrix);
    gl.cullFace(gl.FRONT); // Renderiza só as faces de trás
    gl.enable(gl.CULL_FACE);
    gl.useProgram(outlineProgramInfo.program);
    setBuffersAndAttributes(gl, outlineProgramInfo, bufferInfo);
    setUniforms(outlineProgramInfo, {
        u_worldViewProjection: wvp,
        u_world: worldMatrix,
    });
    drawBufferInfo(gl, bufferInfo);

    gl.cullFace(gl.BACK);
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, bufferInfo);
    setUniforms(programInfo, {
        u_worldViewProjection: wvp,
        u_world: worldMatrix,
        u_lightDirection: luzDirecao,
        u_color: color,
    });
    drawBufferInfo(gl, bufferInfo);
}

// --- CRIAÇÃO DOS OBJETOS 3D ---
// Chão (Plane): O "10, 10" no final significa poucas subdivisões (ideal para low-poly!)
const chaoBuffer = primitives.createPlaneBufferInfo(gl, 400, 400, 10, 10);

// --- CRIAÇÃO DO OVNI ---
// 1. Corpo/Chassi:
const corpoOvniBuffer = primitives.createTruncatedConeBufferInfo(gl, 2.3, 2, 0.5, 10, 1);
// 2. Cabine : 
const cabineOvniBuffer = primitives.createSphereBufferInfo(gl, 1.5, 30, 30);
// 3. Anel :
const anelOvniBuffer = primitives.createTorusBufferInfo(gl, 3.5, 0.2, 10, 12);
// Raio de abdução 
const raioAbducaoBuffer = primitives.createTruncatedConeBufferInfo(gl, 3.5, 0.1, 8, 30, 1);

// --- OBJETOS DA FAZENDA ---

// --- SILO ---
const siloCilindroBuffer = primitives.createCylinderBufferInfo(gl,2,6,16,1);
const siloTetoBuffer = primitives.createSphereBufferInfo(gl, 2, 16, 16);
function desenharSilo(viewProjectionMatrix, posX, posZ){
    desenharComOutline(siloCilindroBuffer, m4.translation([posX, 3, posZ]), viewProjectionMatrix, [0.7, 0.7, 0.7, 1]);
    desenharComOutline(siloTetoBuffer, m4.translation([posX, 6, posZ]), viewProjectionMatrix, [0.5, 0.5, 0.5, 1]);
}

// --- CELEIRO ---
const celeiroCorpoBuffer = primitives.createCubeBufferInfo(gl,4);
const celeiroTetoBuffer = primitives.createTruncatedConeBufferInfo(gl,3.5, 0, 2, 4, 1);
function desenharCeleiro(viewProjectionMatrix, posX, posZ){
    //Desenha o corpo do celeiro
    desenharComOutline(celeiroCorpoBuffer, m4.translation([posX, 2, posZ]), viewProjectionMatrix, [0.7, 0.1, 0.1, 1]);
    let matrizTeto = m4.rotateY(m4.translation([posX, 5, posZ]), Math.PI / 4);
    //Desenha o teto do celeiro
    desenharComOutline(celeiroTetoBuffer,  matrizTeto, viewProjectionMatrix, [0.3, 0.2, 0.1, 1]);
}

// --- ÁRVORE --- 
const troncoBuffer = primitives.createCylinderBufferInfo(gl, 0.5, 2, 6, 1); // Raio 0.5, Altura 2
const folhasBuffer = primitives.createTruncatedConeBufferInfo(gl, 2, 0, 3, 6, 1); // Raio base 2, topo 0, Altura 3
function desenharArvore(viewProjectionMatrix, posX, posZ){
    // Desenha o tronco
    desenharComOutline(troncoBuffer,  m4.translation([posX, 1,   posZ]), viewProjectionMatrix, [0.55, 0.27, 0.07, 1]);
    // Desenha as folhas
    desenharComOutline(folhasBuffer,  m4.translation([posX, 3.5, posZ]), viewProjectionMatrix, [0.2,  0.8,  0.2,  1]);
}

// -- DISTRIBUIÇÃO HARMÔNICA (ESTILO SPORE)
const tamanhoLote = 20;
const colunas = 15;
const linhas = 15;
const limiteTras = 40;
const metadeX = (colunas * tamanhoLote) / 2;
const metadeZ = (linhas * tamanhoLote) / 2;

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
let tempoAbducao = 0;

// --- CONFIGURAÇÃO DE CÂMERA ---
let cameraAtual = 2;
let cameraC = 0; // Variável para alternar entre as câmeras

// --- CONFIGURAÇÃO DE ILUMINAÇÃO ---
const luzDirecao = [-1.0, -0.8, -1.0]; 

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
    // Abdução: suaviza subida/descida enquanto a tecla Espaço é pressionada
    const targetAbduction = teclasPressionadas[" "] ? 1 : 0;
    tempoAbducao += (targetAbduction - tempoAbducao) * deltaTime * 5; // suaviza transição
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
        u_world: m4.identity(),
        u_lightDirection: luzDirecao,
        u_color: [0.3, 0.8, 0.4, 1], // Verde grama
    });
    drawBufferInfo(gl, chaoBuffer);

    // --- DESENHAR OBJETOS ---
    const posNaveZ = navePos[2];
    const posNaveX = navePos[0];

    for (let i = 0; i < objetosFazenda.length; i++){
        let obj = objetosFazenda[i];
        if (obj.z > posNaveZ + metadeZ){
            obj.linha += linhas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.z < posNaveZ - metadeZ){
            obj.linha -= linhas;
            atualizarObjetoFazena(obj);
        }
        if(obj.x < posNaveX - metadeX){
            obj.coluna += colunas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.x > posNaveX + metadeX){
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
    let matrizBaseOvni = m4.translation(navePos);
    // posiciona o cone de abdução de forma que o topo fique logo abaixo da nave
    const coneHalf = 4;
    const worldAbducao = m4.translate(m4.translation(navePos), [0, -(coneHalf + 0.5), 0]);
    matrizBaseOvni = m4.rotateX(matrizBaseOvni, inclinacaoAtualX);  
    matrizBaseOvni = m4.rotateZ(matrizBaseOvni, inclinacaoAtualZ); 
    matrizBaseOvni = m4.rotateY(matrizBaseOvni, time * 2);
    desenharComOutline(corpoOvniBuffer,matrizBaseOvni, viewProjection, [0.6, 0.6, 0.6, 1.0]);
    desenharComOutline(anelOvniBuffer, m4.rotateZ(m4.rotateY(matrizBaseOvni, time * 4), 0.05), viewProjection, [0.1, 0.9, 0.2, 1.0]);
    // Cabine: transparente, sem outline (outline em objeto transparente fica estranho)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const wvpCabine = m4.multiply(viewProjection, m4.translate(matrizBaseOvni, [0, 0.8, 0]));
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, cabineOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: wvpCabine,
        u_world: m4.translate(matrizBaseOvni, [0, 0.8, 0]),
        u_lightDirection: luzDirecao,
        u_color: [0.2, 0.8, 0.8, 0.4],
    });
    drawBufferInfo(gl, cabineOvniBuffer);

    // Desenha o cone de abdução por último (transparência) e sem escrever no depth buffer
    gl.depthMask(false);
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, raioAbducaoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: m4.multiply(viewProjection, worldAbducao),
        u_world: worldAbducao,
        u_lightDirection: luzDirecao,
        u_color: [0.8, 0.8, 0.1, 0.5 * tempoAbducao],
    });
    drawBufferInfo(gl, raioAbducaoBuffer);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);