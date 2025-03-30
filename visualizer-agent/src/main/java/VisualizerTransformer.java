import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;
import javassist.*;
import javassist.bytecode.BadBytecode;
import javassist.bytecode.Bytecode;
import javassist.bytecode.CodeAttribute;
import javassist.bytecode.CodeIterator;
import javassist.bytecode.ConstPool;
import javassist.bytecode.LineNumberAttribute;
import javassist.bytecode.MethodInfo;

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
            // Print every class being transformed (for debugging)
            System.out.println("Trying to transform class: " + className);

            // Skip JDK/internal classes
            if (!className.startsWith("Main") && !className.startsWith("Test")) {
                return null;
            }

            ClassPool cp = ClassPool.getDefault();
            cp.insertClassPath(new LoaderClassPath(loader));
            CtClass ctClass = cp.get(className.replace("/", "."));

    for (CtMethod method : ctClass.getDeclaredMethods()) {
        System.out.println("Transforming method: " + method.getLongName());

        MethodInfo methodInfo = method.getMethodInfo();
        CodeAttribute codeAttribute = methodInfo.getCodeAttribute();

        if (codeAttribute == null) {
            continue;
        }

        LineNumberAttribute lineAttr = (LineNumberAttribute) codeAttribute.getAttribute(LineNumberAttribute.tag);
        if (lineAttr == null) {
            continue;
        }

        CodeIterator iterator = codeAttribute.iterator();
        ConstPool constPool = methodInfo.getConstPool();

        while (iterator.hasNext()) {
            int pos = iterator.next();
            int lineNumber = lineAttr.toLineNumber(pos);

            // Build bytecode to inject System.err.println("VISUALIZER::ClassName.java::LINE::lineNumber");
            Bytecode bytecode = new Bytecode(constPool);
            String message = "VISUALIZER::" + ctClass.getSimpleName() + ".java::LINE::" + lineNumber;
            bytecode.addGetstatic("java/lang/System", "err", "Ljava/io/PrintStream;");
            bytecode.addLdc(message);
            bytecode.addInvokevirtual("java/io/PrintStream", "println", "(Ljava/lang/String;)V");

            try {
                iterator.insertAt(pos, bytecode.get());
            } catch (BadBytecode e) {
                System.err.println("Failed to inject at line: " + lineNumber);
                e.printStackTrace();
            }
        }

        codeAttribute.setMaxStack(codeAttribute.getMaxStack() + 2);
    }


            byte[] byteCode = ctClass.toBytecode();
            ctClass.detach(); // cleanup
            return byteCode;

        } catch (Exception e) {
            System.out.println("Exception while transforming " + className);
            e.printStackTrace();
        }

        return null;
    }
}
