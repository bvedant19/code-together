import FormComponent from "@/components/forms/FormComponent"
// import Footer from "@/components/common/Footer";

function HomePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-dark text-light p-4">
            <div className="w-[500px] animate-fade-in rounded-lg border border-darkHover bg-darkHover p-8 shadow-lg">
                <FormComponent />
            </div>
            {/* <Footer /> */}
        </div>
    )
}

export default HomePage
