import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;
import javassist.*;

public class VisualizerTransformer implements ClassFileTransformer {

    @Override
    public byte[] transform(
        ClassLoader loader,
        String className,
        Class<?> classBeingRedefined,
        ProtectionDomain protectionDomain,
        byte[] classfileBuffer
    ) {
        if (className == null) {
            return null;
        }

        try {
            ClassPool cp = ClassPool.getDefault();
            cp.insertClassPath(new LoaderClassPath(loader));
            CtClass ctClass = cp.get(className.replace("/", "."));

            for (CtMethod method : ctClass.getDeclaredMethods()) {
                int line = -1;
                try {
                    line = method.getMethodInfo().getLineNumber(0);
                } catch (Exception ignored) {}
            
                method.insertBefore("System.out.println(\"VISUALIZER::" + ctClass.getSimpleName() + ".java::LINE::" + line + "\");");
            }

            byte[] byteCode = ctClass.toBytecode();
            ctClass.detach(); // cleanup
            return byteCode;

        } catch (Exception e) {
            e.printStackTrace();
        }

        return null;
    }
}
