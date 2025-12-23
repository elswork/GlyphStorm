export class WebGPURenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.adapter = null;
        this.device = null;
        this.context = null;
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.particles = [];
        this.maxParticles = 1000;
        this.clearColor = { r: 0.1, g: 0.1, b: 0.1, a: 1.0 };
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        this.device = await this.adapter.requestDevice();
        this.context = this.canvas.getContext("webgpu");

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "premultiplied",
        });

        await this.initPipeline();
        await this.initParticlePipeline();
        console.log("WebGPU Initialized");
    }

    async initPipeline() {
        const shaderModule = this.device.createShaderModule({
            label: 'Enemy Shader',
            code: `
                struct Uniforms {
                    screenSize: vec2f,
                }
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                struct InstanceInput {
                    @location(0) pos: vec2f,
                    @location(1) size: vec2f,
                    @location(2) color: vec3f,
                }

                @vertex
                fn vs(
                    @builtin(vertex_index) vertexIndex: u32,
                    instance: InstanceInput
                ) -> VertexOutput {
                    var pos = array<vec2f, 6>(
                        vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
                        vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
                    );
                    
                    let vertexPos = pos[vertexIndex];
                    // Map 0..1 to -1..1 clip space, adjusting for instance pos and size
                    // Instance pos is 0..1 (top-left origin for game logic, but clip space is center origin)
                    // Let's assume game logic sends 0..1 coordinates where (0,0) is top-left.
                    
                    let pixelPos = (instance.pos + vertexPos * instance.size) * uniforms.screenSize;
                    let clipPos = (pixelPos / uniforms.screenSize) * 2.0 - 1.0;
                    
                    // Flip Y because WebGPU clip space Y is up, but screen Y is usually down
                    var output: VertexOutput;
                    output.position = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
                    output.color = vec4f(instance.color, 1.0);
                    return output;
                }

                @fragment
                fn fs(input: VertexOutput) -> @location(0) vec4f {
                    return input.color;
                }
            `
        });

        this.pipeline = this.device.createRenderPipeline({
            label: 'Enemy Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs',
                buffers: [{
                    arrayStride: 7 * 4, // 2+2+3 floats * 4 bytes
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' }, // pos
                        { shaderLocation: 1, offset: 8, format: 'float32x2' }, // size
                        { shaderLocation: 2, offset: 16, format: 'float32x3' }, // color
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs',
                targets: [{ format: this.format }]
            }
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 8, // vec2f
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        // Initial instance buffer capacity
        this.instanceBufferCapacity = 100;
        this.instanceBuffer = this.device.createBuffer({
            size: this.instanceBufferCapacity * 7 * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    async initParticlePipeline() {
        const shaderModule = this.device.createShaderModule({
            label: 'Particle Shader',
            code: `
                struct Uniforms {
                    screenSize: vec2f,
                }
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                struct ParticleInput {
                    @location(0) pos: vec2f,
                    @location(1) color: vec4f,
                }

                @vertex
                fn vs(@builtin(vertex_index) vi: u32, p: ParticleInput) -> VertexOutput {
                    var out: VertexOutput;
                    let size = 0.005; // Fixed particle size
                    var quad = array<vec2f, 4>(
                        vec2f(-1.0, -1.0), vec2f( 1.0, -1.0),
                        vec2f(-1.0,  1.0), vec2f( 1.0,  1.0)
                    );
                    
                    let pPos = p.pos * 2.0 - 1.0;
                    let vPos = quad[vi] * size;
                    out.position = vec4f(pPos.x + vPos.x, -(pPos.y + vPos.y), 0.0, 1.0);
                    out.color = p.color;
                    return out;
                }

                @fragment
                fn fs(in: VertexOutput) -> @location(0) vec4f {
                    return in.color;
                }
            `
        });

        this.particlePipeline = this.device.createRenderPipeline({
            label: 'Particle Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs',
                buffers: [{
                    arrayStride: 6 * 4, // 2 (pos) + 4 (color) floats
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' },
                        { shaderLocation: 1, offset: 8, format: 'float32x4' },
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs',
                targets: [{
                    format: this.format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        this.particleBuffer = this.device.createBuffer({
            size: this.maxParticles * 6 * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    addExplosion(x, y, color = [1, 0.5, 0, 1]) {
        for (let i = 0; i < 50; i++) {
            if (this.particles.length >= this.maxParticles) this.particles.shift();
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 0.01,
                vy: (Math.random() - 0.5) * 0.01,
                life: 1.0,
                color: [...color]
            });
        }
    }

    render(gameState) {
        if (!this.device || !this.pipeline) return;

        // Update Uniforms
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([canvasWidth, canvasHeight]));

        // Prepare Instance Data
        const enemies = gameState.enemies || [];
        const instanceCount = enemies.length;

        if (instanceCount > 0) {
            // Resize buffer if needed
            if (instanceCount > this.instanceBufferCapacity) {
                this.instanceBufferCapacity = instanceCount * 2;
                this.instanceBuffer.destroy();
                this.instanceBuffer = this.device.createBuffer({
                    size: this.instanceBufferCapacity * 7 * 4,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
            }

            const instanceData = new Float32Array(instanceCount * 7);
            for (let i = 0; i < instanceCount; i++) {
                const e = enemies[i];
                const offset = i * 7;
                instanceData[offset + 0] = e.x; // x
                instanceData[offset + 1] = e.y; // y
                instanceData[offset + 2] = e.isBoss ? 0.2 : 0.1; // width
                instanceData[offset + 3] = e.isBoss ? 0.08 : 0.05; // height
                instanceData[offset + 4] = e.isBoss ? 1.0 : 1.0; // r
                instanceData[offset + 5] = e.isBoss ? 0.84 : 0.0; // g
                instanceData[offset + 6] = e.isBoss ? 0.0 : 0.0; // b
            }
            this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
        }

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: this.clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        if (instanceCount > 0) {
            passEncoder.setVertexBuffer(0, this.instanceBuffer);
            passEncoder.draw(6, instanceCount);
        }

        // Render Particles
        if (this.particles.length > 0) {
            // Update particles (normally compute shader would do this, but for simplicity let's do it on CPU for now)
            // In a real WebGPU app, we'd use a compute pass.
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.01;
                p.color[3] = p.life;
                return p.life > 0;
            });

            if (this.particles.length > 0) {
                const particleData = new Float32Array(this.particles.length * 6);
                for (let i = 0; i < this.particles.length; i++) {
                    const p = this.particles[i];
                    particleData[i * 6 + 0] = p.x;
                    particleData[i * 6 + 1] = p.y;
                    particleData[i * 6 + 2] = p.color[0];
                    particleData[i * 6 + 3] = p.color[1];
                    particleData[i * 6 + 4] = p.color[2];
                    particleData[i * 6 + 5] = p.color[3];
                }
                this.device.queue.writeBuffer(this.particleBuffer, 0, particleData);

                passEncoder.setPipeline(this.particlePipeline);
                passEncoder.setVertexBuffer(0, this.particleBuffer);
                passEncoder.draw(4, this.particles.length);
            }
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
